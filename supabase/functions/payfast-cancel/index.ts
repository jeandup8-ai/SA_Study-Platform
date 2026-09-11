// Supabase Edge Function: payfast-cancel
//
// Authenticated (parent JWT). Self-service cancellation for the caller's own
// most recent subscription. Always records the cancellation intent in our
// own database (cancel_requested_at, status) regardless of whether the
// best-effort call to PayFast's recurring-billing API succeeds -- a parent's
// "cancel" click must never silently no-op just because an external API call
// failed. If the PayFast-side call fails, the merchant can still cancel the
// token manually from the PayFast dashboard (Transactions > Customer
// Subscriptions) as a fallback; that gap is logged, not hidden.
//
// PayFast's subscription-cancel REST API (api.payfast.co.za) uses a
// different auth scheme to the checkout/ITN form signature -- see the
// signing comment inline below, confirmed against developers.payfast.co.za
// and verified against a real sandbox subscription. A failure here is
// caught and only logged, it does not block the local cancellation record
// below -- a parent's "cancel" click must never depend on this call
// succeeding, since our own database is the source of truth for billing.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
}

// PHP's urlencode(), which is what http_build_query() uses internally to
// encode each value -- matches encodeURIComponent except space -> '+' and
// !'()* and ~ are also percent-escaped (encodeURIComponent leaves those
// unreserved). Verified against known PHP urlencode output before use.
function phpUrlEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/%20/g, '+')
    .replace(/[!'()*~]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
}

// Minimal RFC 1321 MD5 -- same implementation as payfast-checkout/payfast-itn,
// verified against Node's crypto.createHash('md5') for known test vectors
// before use. Deno's Web Crypto has no native MD5, and this avoids depending
// on unconfirmed node:crypto support in the edge runtime for signed calls.
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'missing_authorization' }, 401)

  const supabaseAsUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
  } = await supabaseAsUser.auth.getUser()
  if (!user) return jsonResponse({ error: 'unauthorized' }, 401)

  const { data: subscription } = await supabaseAsUser
    .from('subscriptions')
    .select('id, status, provider_subscription_id')
    .eq('parent_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!subscription) return jsonResponse({ error: 'no_subscription' }, 404)
  if (subscription.status === 'canceled') return jsonResponse({ subscription })

  // Owner UPDATE is still allowed for non-billing columns (see
  // subscriptions_protect_billing_fields) -- this records the request even
  // if everything below fails.
  await supabaseAsUser.from('subscriptions').update({ cancel_requested_at: new Date().toISOString() }).eq('id', subscription.id)

  let payfastCancelSucceeded = false
  if (subscription.provider_subscription_id) {
    try {
      const merchantId = Deno.env.get('PAYFAST_MERCHANT_ID') ?? ''
      const passphrase = Deno.env.get('PAYFAST_PASSPHRASE')
      // Per developers.payfast.co.za's Authentication page, which gives this
      // reference PHP implementation:
      //   if ($passPhrase !== null) $pfData['passphrase'] = $passPhrase;
      //   ksort($pfData);
      //   return md5(http_build_query($pfData));
      // i.e.: alphabetise the header variables (adding passphrase to the set
      // ONLY when one is actually configured -- not as an empty value), then
      // url-encode each value the same way http_build_query/PHP's urlencode()
      // does, join with '&'. No case-folding of the string itself (the
      // "characters must be in lower case" line on another page turned out to
      // just describe the output hex digest, not the input -- confirmed by
      // this reference implementation, which doesn't lower-case anything).
      const timestamp = new Date().toISOString().slice(0, 19) + '+00:00'
      const version = 'v1'
      const mode = Deno.env.get('PAYFAST_MODE') ?? 'sandbox'
      // The Signature Generation reference page notes: "When in test mode
      // the testing parameter should be excluded from the signature" --
      // meaning a `testing=true` query param exists to tell PayFast's API
      // (same api.payfast.co.za host, no separate sandbox host for this
      // endpoint) to look the merchant ID up against their sandbox merchant
      // database instead of production. Without it, a sandbox-only merchant
      // ID is correctly reported as "not found" against production -- which
      // is exactly the error every prior attempt hit here, regardless of
      // signature correctness (a strong tell it was never a signing bug).
      const url = `https://api.payfast.co.za/subscriptions/${subscription.provider_subscription_id}/cancel${mode === 'live' ? '' : '?testing=true'}`
      const fields: Record<string, string> = { 'merchant-id': merchantId, timestamp, version }
      if (passphrase) fields.passphrase = passphrase
      const signatureBase = Object.keys(fields)
        .sort()
        .map((k) => `${k}=${phpUrlEncode(fields[k])}`)
        .join('&')
      const signature = md5Hex(signatureBase)
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'merchant-id': merchantId,
          version,
          timestamp,
          signature,
        },
      })
      const responseBody = await response.json().catch(() => null)
      payfastCancelSucceeded = response.ok && responseBody?.status === 'success'
      if (!payfastCancelSucceeded) {
        console.error(`PayFast cancel API returned ${response.status}: ${JSON.stringify(responseBody)}`)
      }
    } catch (err) {
      console.error(`PayFast cancel API call threw: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // Service-role client only for the actual status transition -- the trigger
  // blocks the owner client from doing this itself.
  const supabaseService = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  await supabaseService.from('subscriptions').update({ status: 'canceled' }).eq('id', subscription.id)

  return jsonResponse({ canceled: true, payfastCancelSucceeded })
})
