// Supabase Edge Function: moderate-upload
//
// Real, server-side moderation gate for "Scan My Work" uploads. The client sends
// the raw file here and gets back only a decision + machine reason codes — never
// the reverse. This is deliberate: safety-critical checks must not be trustable
// only on the client, credentials for the vision-safety provider must never reach
// the browser bundle, and the child-facing app must never see provider-specific
// detail (confidence scores, category names) that could leak how to game it.
//
// What actually runs today:
//   1. File type / size validation — authoritative here, independent of whatever
//      the client already checked (a modified client must not be able to skip it).
//   2. Real EXIF GPS extraction on JPEGs — genuine metadata parsing, not a stub.
//   3. If SIGHTENGINE_API_USER / SIGHTENGINE_API_SECRET are set as Edge Function
//      secrets (`supabase secrets set ...` — never in this repo, never in git),
//      the image is sent to Sightengine for nudity / weapons / drugs / gore /
//      offensive-content detection and rejected on a positive match.
//
// If those secrets are NOT set, this function still runs — it just reports
// `visualSafetyChecked: false` so the app can be honest that the deep visual scan
// didn't happen, rather than silently pretending a check occurred. It never
// fabricates a "safe" verdict for a check it didn't actually run.
//
// To connect a different provider (AWS Rekognition, Google Cloud Vision SafeSearch,
// Hive, etc.), replace the Sightengine call below with that provider's request and
// swap the env var names — nothing else in this function or the client needs to change.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_FILE_BYTES = 8 * 1024 * 1024 // 8MB — comfortably under Edge Function request-body limits

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type ReasonCode =
  | 'unsupported_file_type'
  | 'file_too_large'
  | 'suspected_unsafe_content'
  | 'gps_location_detected'
  | 'moderation_provider_error'
  | 'demo_simulated_rejection'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

async function checkGpsMetadata(file: File): Promise<boolean> {
  if (file.type === 'application/pdf') return false
  try {
    // Dynamic + try/caught so a remote-module fetch failure only disables this one
    // check, rather than crashing the whole function at boot (a static top-level
    // import here would take down file-type/size checks and the vision-safety call
    // too if esm.sh were ever unreachable from the edge runtime).
    const { gps } = await import('https://esm.sh/exifr@7.1.3')
    const buffer = new Uint8Array(await file.arrayBuffer())
    const coords = await gps(buffer)
    return Boolean(coords && (coords.latitude || coords.longitude))
  } catch {
    // Covers both "failed to load the exifr module" and "no readable EXIF GPS
    // block in this file" — neither is itself a safety signal worth rejecting on.
    return false
  }
}

interface SightengineResult {
  nudity?: { sexual_activity?: number; sexual_display?: number; erotica?: number }
  weapon?: { classes?: Record<string, number> }
  recreational_drug?: { prob?: number }
  gore?: { prob?: number }
  offensive?: { prob?: number }
}

async function checkWithSightengine(file: File, apiUser: string, apiSecret: string): Promise<'safe' | 'unsafe' | 'error'> {
  try {
    const form = new FormData()
    form.append('media', file, 'upload')
    form.append('models', 'nudity-2.1,weapon,recreational_drug,gore-2.0,offensive-2.0')
    form.append('api_user', apiUser)
    form.append('api_secret', apiSecret)

    const response = await fetch('https://api.sightengine.com/1.0/check.json', { method: 'POST', body: form })
    if (!response.ok) return 'error'

    const result = (await response.json()) as SightengineResult
    const threshold = 0.5
    const nudityFlagged =
      (result.nudity?.sexual_activity ?? 0) > threshold ||
      (result.nudity?.sexual_display ?? 0) > threshold ||
      (result.nudity?.erotica ?? 0) > threshold
    const weaponFlagged = Object.values(result.weapon?.classes ?? {}).some((score) => score > threshold)
    const drugFlagged = (result.recreational_drug?.prob ?? 0) > threshold
    const goreFlagged = (result.gore?.prob ?? 0) > threshold
    const offensiveFlagged = (result.offensive?.prob ?? 0) > threshold

    return nudityFlagged || weaponFlagged || drugFlagged || goreFlagged || offensiveFlagged ? 'unsafe' : 'safe'
  } catch {
    return 'error'
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  const simulateUnsafe = form?.get('simulateUnsafe') === 'true'

  if (!(file instanceof File)) {
    return jsonResponse({ error: 'missing_file' }, 400)
  }

  const reasonCodes: ReasonCode[] = []

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return jsonResponse({ decision: 'rejected', reasonCodes: ['unsupported_file_type'], visualSafetyChecked: false })
  }
  if (file.size > MAX_FILE_BYTES) {
    return jsonResponse({ decision: 'rejected', reasonCodes: ['file_too_large'], visualSafetyChecked: false })
  }
  if (simulateUnsafe) {
    return jsonResponse({ decision: 'rejected', reasonCodes: ['demo_simulated_rejection'], visualSafetyChecked: false })
  }

  if (await checkGpsMetadata(file)) {
    reasonCodes.push('gps_location_detected')
  }

  const apiUser = Deno.env.get('SIGHTENGINE_API_USER')
  const apiSecret = Deno.env.get('SIGHTENGINE_API_SECRET')
  let visualSafetyChecked = false

  if (apiUser && apiSecret && file.type !== 'application/pdf') {
    visualSafetyChecked = true
    const verdict = await checkWithSightengine(file, apiUser, apiSecret)
    if (verdict === 'unsafe') reasonCodes.push('suspected_unsafe_content')
    // A provider error fails closed: the app already told the child a check was
    // running, so a failed check must not silently become an approval.
    if (verdict === 'error') reasonCodes.push('moderation_provider_error')
  }

  const decision = reasonCodes.length > 0 ? 'rejected' : 'approved'
  return jsonResponse({ decision, reasonCodes, visualSafetyChecked })
})
