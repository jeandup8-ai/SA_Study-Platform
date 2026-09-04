// Supabase Edge Function: email-unsubscribe
//
// One-click unsubscribe for the weekly parent digest. Deliberately public
// (verify_jwt=false): someone who no longer wants our email must be able to
// stop it from the email itself, without logging in, on any device.
//
// Authorisation is the unsubscribe_token in the URL — an opaque per-parent
// uuid that only ever travels inside that parent's own email. It grants
// exactly one capability: turning that parent's digest off. It cannot read
// account data, cannot turn the digest back on (that requires signing in),
// and cannot be used to enumerate accounts — an unknown token returns the
// same generic page as a known one.
//
// Handles both:
//   - GET  — a person clicking the link, gets a human-readable page.
//   - POST — RFC 8058 one-click unsubscribe, sent automatically by Gmail /
//     Outlook when the reader hits their native "unsubscribe" button.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function htmlPage(message: string, status = 200): Response {
  return new Response(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>StudyLegends email preferences</title>
  </head>
  <body style="font-family:sans-serif;background:#f8fafc;margin:0;padding:48px 16px;">
    <div style="max-width:420px;margin:0 auto;background:#fff;border-radius:24px;padding:32px;text-align:center;">
      <h1 style="font-size:20px;color:#0f172a;">StudyLegends</h1>
      <p style="color:#475569;">${message}</p>
      <a href="https://studylegends.co.za" style="display:inline-block;margin-top:16px;color:#0d9488;font-weight:600;">Back to StudyLegends</a>
    </div>
  </body>
</html>`,
    { status, headers: { ...CORS_HEADERS, 'Content-Type': 'text/html; charset=utf-8' } },
  )
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'GET' && req.method !== 'POST') {
    return htmlPage('Something went wrong. Please try the link in your email again.', 405)
  }

  const token = new URL(req.url).searchParams.get('token')
  if (!token) {
    return htmlPage('This unsubscribe link is incomplete. Please use the link exactly as it appears in your email.', 400)
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { error } = await supabase
    .from('parents')
    .update({ weekly_digest_enabled: false })
    .eq('unsubscribe_token', token)

  if (error) {
    return htmlPage('We could not update your preferences just now. Please try again in a few minutes.', 500)
  }

  // Same response whether or not the token matched a real parent — an
  // unsubscribe endpoint must not confirm whether an address is registered.
  return htmlPage(
    'You have been unsubscribed from the weekly progress email. You will still receive essential account emails, such as password resets. You can turn the weekly email back on any time under Parent → Settings in the app.',
  )
})
