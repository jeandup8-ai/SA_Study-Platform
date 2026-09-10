// Supabase Edge Function: payfast-itn
//
// PUBLIC webhook (verify_jwt=false at deploy time -- PayFast cannot send a
// Supabase auth JWT). This is the ONLY place a subscription is ever marked
// 'active': payfast-checkout only ever creates 'incomplete' rows, and a
// database trigger (subscriptions_protect_billing_fields) blocks a signed-in
// parent from setting status/plan_id/provider* on their own row -- only the
// service-role client used here can.
//
// Verification, in order, all of which must pass before any DB write:
//   1. Recompute the MD5 signature over the fields AS RECEIVED (order
//      matters -- this is different from the checkout field order, which is
//      fixed; ITN fields must be read back in the order PayFast sent them).
//   2. Server-to-server "validate" call back to PayFast with the raw body,
//      confirming PayFast (not a forged POST) actually sent this notification.
//   3. merchant_id in the payload matches our own PAYFAST_MERCHANT_ID.
//   4. amount_gross matches the plan price looked up server-side (never
//      trust the amount an attacker could have altered client-side).
//   5. provider_event_id (pf_payment_id) hasn't been processed before --
//      payment_events has a unique constraint enforcing this at the DB level.
//
// Requires the same PAYFAST_* secrets as payfast-checkout.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

function phpUrlEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/%20/g, '+')
    .replace(/[!'()*~]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
}

// Minimal RFC 1321 MD5 -- verified against Node's crypto.createHash('md5')
// for '', 'abc', the standard "quick brown fox" vector, and a realistic
// PayFast-shaped query string before this went into payment code. Deno's
// Web Crypto (SubtleCrypto) does not implement MD5, hence a local
// implementation rather than relying on an unconfirmed npm/node dependency
// in the edge runtime for something this security-sensitive.
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

function addInterval(from: Date, intervalMonths: number): Date {
  const d = new Date(from)
  d.setMonth(d.getMonth() + intervalMonths)
  return d
}

Deno.serve(async (req: Request) => {
  // PayFast expects a bare 200 regardless of outcome, to stop it retrying --
  // errors below are logged, never thrown back as a non-200 status.
  if (req.method !== 'POST') return new Response('ok')

  const rawBody = await req.text()
  const params = new URLSearchParams(rawBody)
  const orderedPairs: [string, string][] = []
  for (const [k, v] of params) {
    if (k !== 'signature') orderedPairs.push([k, v])
  }
  const receivedSignature = params.get('signature') ?? ''
  const data = Object.fromEntries(orderedPairs)

  const passphrase = Deno.env.get('PAYFAST_PASSPHRASE') ?? ''
  const mode = Deno.env.get('PAYFAST_MODE') ?? 'sandbox'
  const merchantId = Deno.env.get('PAYFAST_MERCHANT_ID')

  const signatureBase = orderedPairs.map(([k, v]) => `${k}=${phpUrlEncode(v)}`).join('&')
  const signedString = passphrase ? `${signatureBase}&passphrase=${phpUrlEncode(passphrase)}` : signatureBase
  const computedSignature = md5Hex(signedString)
  const signatureValid = computedSignature === receivedSignature

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  let serverValidated = false
  if (signatureValid) {
    try {
      const validateUrl =
        mode === 'live' ? 'https://www.payfast.co.za/eng/query/validate' : 'https://sandbox.payfast.co.za/eng/query/validate'
      const validateResponse = await fetch(validateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: rawBody,
      })
      const validateText = (await validateResponse.text()).trim()
      serverValidated = validateText === 'VALID'
    } catch (err) {
      console.error(`PayFast validate call failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const pfPaymentId = data['pf_payment_id'] ?? data['m_payment_id'] ?? crypto.randomUUID()
  const subscriptionId = data['custom_str1']
  const planId = data['custom_str2']
  const paymentStatus = data['payment_status']
  const amountGross = data['amount_gross'] ? Number(data['amount_gross']) : null

  const { data: eventRow, error: eventInsertError } = await supabase
    .from('payment_events')
    .insert({
      provider: 'payfast',
      provider_event_id: pfPaymentId,
      subscription_id: subscriptionId ?? null,
      payment_status: paymentStatus ?? null,
      amount_gross: amountGross,
      raw_payload: data,
      signature_valid: signatureValid,
      server_validated: serverValidated,
    })
    .select('id')
    .single()

  // A unique-constraint violation here means we've already processed this
  // exact PayFast event -- acknowledge and stop, do not double-apply it.
  if (eventInsertError) {
    if (eventInsertError.code === '23505') return new Response('ok')
    console.error(`payment_events insert failed: ${eventInsertError.message}`)
    return new Response('ok')
  }

  if (!signatureValid || !serverValidated || !merchantId || data['merchant_id'] !== merchantId || !subscriptionId) {
    console.error(
      `ITN rejected: signatureValid=${signatureValid} serverValidated=${serverValidated} merchantMatch=${data['merchant_id'] === merchantId} subscriptionId=${subscriptionId}`,
    )
    return new Response('ok')
  }

  const { data: plan } = await supabase
    .from('subscription_plans')
    .select('id, price_cents, billing_interval')
    .eq('id', planId)
    .maybeSingle()

  if (!plan || amountGross == null || Math.abs(amountGross - plan.price_cents / 100) > 0.01) {
    console.error(`ITN amount mismatch: expected=${plan ? plan.price_cents / 100 : 'unknown'} received=${amountGross}`)
    await supabase.from('payment_events').update({ processed_at: new Date().toISOString() }).eq('id', eventRow.id)
    return new Response('ok')
  }

  const intervalMonths = plan.billing_interval === 'monthly' ? 1 : 12
  const token = data['token']

  if (paymentStatus === 'COMPLETE') {
    await supabase
      .from('subscriptions')
      .update({
        status: 'active',
        current_period_end: addInterval(new Date(), intervalMonths).toISOString(),
        provider: 'payfast',
        provider_customer_id: pfPaymentId,
        ...(token ? { provider_subscription_id: token } : {}),
      })
      .eq('id', subscriptionId)
  } else if (paymentStatus === 'CANCELLED') {
    await supabase.from('subscriptions').update({ status: 'canceled' }).eq('id', subscriptionId)
  } else if (paymentStatus === 'FAILED') {
    await supabase.from('subscriptions').update({ status: 'past_due' }).eq('id', subscriptionId)
  }

  await supabase.from('payment_events').update({ processed_at: new Date().toISOString() }).eq('id', eventRow.id)

  return new Response('ok')
})
