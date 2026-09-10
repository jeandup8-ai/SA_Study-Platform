// Supabase Edge Function: payfast-checkout
//
// Authenticated (parent JWT). Given a subscription_plans.id, creates an
// 'incomplete' subscriptions row scoped to the caller (RLS-respecting insert,
// no service role needed here) and returns the exact field set + MD5
// signature the client must POST to PayFast to start payment. The actual
// activation happens later in payfast-itn once PayFast confirms payment --
// this function never marks a subscription active itself.
//
// Requires these Supabase secrets to be set before this can run for real:
//   PAYFAST_MERCHANT_ID, PAYFAST_MERCHANT_KEY, PAYFAST_MODE ('sandbox'|'live')
//   PAYFAST_PASSPHRASE (optional but strongly recommended -- set one in the
//     PayFast merchant dashboard under Settings > Integration, then mirror it
//     here; it is the shared secret that makes the signature unforgeable)
//   APP_BASE_URL (e.g. https://www.studylegends.co.za)
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// PHP's urlencode(): like encodeURIComponent, but space -> '+' and
// !'()* and ~ are also percent-escaped (encodeURIComponent leaves those
// unreserved). PayFast's signature spec is defined in terms of PHP's
// urlencode(), so this must match it exactly or every signature will mismatch.
function phpUrlEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/%20/g, '+')
    .replace(/[!'()*~]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
}

// Minimal RFC 1321 MD5, verified against Node's crypto for known test
// vectors (including a realistic PayFast-shaped query string) before use --
// see the implementation note in payfast-itn for the same function.
function md5Hex(input: string): string {
  function rotl(x: number, c: number) {
    return (x << c) | (x >>> (32 - c))
  }
  const K = new Uint32Array([
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
    0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
    0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
    0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
    0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
    0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
  ])
  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15,
    21,
  ]

  const msg = new TextEncoder().encode(input)
  const origLenBits = BigInt(msg.length) * 8n

  const withOne = new Uint8Array(msg.length + 1)
  withOne.set(msg)
  withOne[msg.length] = 0x80

  let paddedLen = withOne.length
  while (paddedLen % 64 !== 56) paddedLen++

  const buf = new Uint8Array(paddedLen + 8)
  buf.set(withOne)
  const view = new DataView(buf.buffer)
  view.setBigUint64(paddedLen, origLenBits, true)

  let a0 = 0x67452301,
    b0 = 0xefcdab89,
    c0 = 0x98badcfe,
    d0 = 0x10325476

  for (let chunkStart = 0; chunkStart < buf.length; chunkStart += 64) {
    const M = new Uint32Array(16)
    for (let i = 0; i < 16; i++) M[i] = view.getUint32(chunkStart + i * 4, true)
    let A = a0,
      B = b0,
      C = c0,
      D = d0
    for (let i = 0; i < 64; i++) {
      let F: number, g: number
      if (i < 16) {
        F = (B & C) | (~B & D)
        g = i
      } else if (i < 32) {
        F = (D & B) | (~D & C)
        g = (5 * i + 1) % 16
      } else if (i < 48) {
        F = B ^ C ^ D
        g = (3 * i + 5) % 16
      } else {
        F = C ^ (B | ~D)
        g = (7 * i) % 16
      }
      F = (F + A + K[i] + M[g]) >>> 0
      A = D
      D = C
      C = B
      B = (B + rotl(F, S[i])) >>> 0
    }
    a0 = (a0 + A) >>> 0
    b0 = (b0 + B) >>> 0
    c0 = (c0 + C) >>> 0
    d0 = (d0 + D) >>> 0
  }

  const out = new Uint8Array(16)
  const ov = new DataView(out.buffer)
  ov.setUint32(0, a0, true)
  ov.setUint32(4, b0, true)
  ov.setUint32(8, c0, true)
  ov.setUint32(12, d0, true)
  return Array.from(out)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

const FREQUENCY_BY_INTERVAL: Record<string, number> = { monthly: 3, annual: 6 }

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'missing_authorization' }, 401)

  const body = await req.json().catch(() => null)
  const planId = body?.planId
  if (typeof planId !== 'string') return jsonResponse({ error: 'missing_plan_id' }, 400)

  const merchantId = Deno.env.get('PAYFAST_MERCHANT_ID')
  const merchantKey = Deno.env.get('PAYFAST_MERCHANT_KEY')
  const passphrase = Deno.env.get('PAYFAST_PASSPHRASE') ?? ''
  const mode = Deno.env.get('PAYFAST_MODE') ?? 'sandbox'
  const appBaseUrl = Deno.env.get('APP_BASE_URL') ?? 'https://www.studylegends.co.za'
  if (!merchantId || !merchantKey) return jsonResponse({ error: 'feature_not_configured' }, 503)

  // Scoped to the caller's own JWT -- the insert below only succeeds because
  // subscriptions_owner_insert already requires parent_id = auth.uid().
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return jsonResponse({ error: 'unauthorized' }, 401)

  const { data: plan } = await supabase
    .from('subscription_plans')
    .select('id, price_cents, billing_interval, is_active')
    .eq('id', planId)
    .maybeSingle()
  if (!plan || !plan.is_active || plan.price_cents == null) return jsonResponse({ error: 'plan_not_found' }, 404)

  const { data: parentRow } = await supabase.from('parents').select('full_name, email').eq('id', user.id).maybeSingle()

  const { data: subscription, error: insertError } = await supabase
    .from('subscriptions')
    .insert({ parent_id: user.id, plan_id: plan.id, status: 'incomplete', provider: 'payfast' })
    .select('id')
    .single()
  if (insertError || !subscription) {
    console.error(`subscription insert failed: ${insertError?.message}`)
    return jsonResponse({ error: 'subscription_create_failed' }, 500)
  }

  const amount = (plan.price_cents / 100).toFixed(2)
  const [nameFirst, ...rest] = (parentRow?.full_name ?? 'StudyLegends Parent').trim().split(/\s+/)
  const nameLast = rest.join(' ') || nameFirst
  const frequency = FREQUENCY_BY_INTERVAL[plan.billing_interval] ?? 3
  const today = new Date().toISOString().slice(0, 10)

  // Field order below is PayFast's documented signature order -- do not
  // reorder without re-checking developers.payfast.co.za, the signature is
  // order-dependent.
  const fields: [string, string][] = [
    ['merchant_id', merchantId],
    ['merchant_key', merchantKey],
    ['return_url', `${appBaseUrl}/parent/subscription?payment=success`],
    ['cancel_url', `${appBaseUrl}/parent/subscription?payment=cancelled`],
    ['notify_url', `${Deno.env.get('SUPABASE_URL')}/functions/v1/payfast-itn`],
    ['name_first', nameFirst],
    ['name_last', nameLast],
    ['email_address', parentRow?.email ?? user.email ?? ''],
    ['m_payment_id', subscription.id],
    ['amount', amount],
    ['item_name', 'StudyLegends Subscription'],
    ['item_description', `${plan.billing_interval === 'monthly' ? 'Monthly' : 'Annual'} subscription`],
    ['custom_str1', subscription.id],
    ['custom_str2', plan.id],
    ['subscription_type', '1'],
    ['billing_date', today],
    ['recurring_amount', amount],
    ['frequency', String(frequency)],
    ['cycles', '0'],
  ]

  const signatureBase = fields.map(([k, v]) => `${k}=${phpUrlEncode(v)}`).join('&')
  const signedString = passphrase ? `${signatureBase}&passphrase=${phpUrlEncode(passphrase)}` : signatureBase
  const signature = md5Hex(signedString)

  const processUrl = mode === 'live' ? 'https://www.payfast.co.za/eng/process' : 'https://sandbox.payfast.co.za/eng/process'

  return jsonResponse({
    action: processUrl,
    fields: { ...Object.fromEntries(fields), signature },
  })
})
