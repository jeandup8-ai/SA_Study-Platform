// Supabase Edge Function: weekly-parent-digest
//
// A weekly email to each parent summarising their children's week — study
// time, topics practiced, current streak, and topics needing attention.
// Mirrors the same numbers already shown on the in-app parent dashboard
// (see src/lib/parent/dashboard.ts) so the email never tells a parent
// something the app itself wouldn't.
//
// This is a backend batch job, not a per-user request: it reads across every
// parent's data, so it uses the service-role key (bypasses RLS) rather than
// a caller's JWT. Because of that, it does NOT rely on Supabase's JWT
// verification (deployed with verify_jwt=false) — instead it requires a
// shared secret (CRON_SECRET) on every call, checked before anything else
// runs. Intended to be triggered by a scheduled job (Supabase Studio ->
// Database -> Cron Jobs, an HTTP request job calling this URL weekly) rather
// than by the app itself.
//
// If a learner had zero activity this week, they still get a line in the
// digest — a gentle nudge with a suggested topic to start with — rather than
// being silently skipped. A weekly digest that only ever reports good news
// misses the families most worth re-engaging.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function startOfWeekIso(): string {
  const now = new Date()
  const day = now.getUTCDay() === 0 ? 7 : now.getUTCDay()
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() - (day - 1))
  monday.setUTCHours(0, 0, 0, 0)
  return monday.toISOString()
}

function formatMinutes(seconds: number): number {
  return Math.round(seconds / 60)
}

interface LearnerDigest {
  displayName: string
  streak: number
  minutesThisWeek: number
  lessonsCompleted: number
  questionsAnswered: number
  attentionTopics: string[]
  hadActivity: boolean
}

const STRINGS = {
  en: {
    subject: 'Your family’s week on StudyLegends',
    heading: (name: string) => `Hi ${name}, here’s this week's progress`,
    streak: (n: number) => (n > 0 ? `🔥 ${n} day streak` : 'No active streak yet'),
    minutes: (n: number) => `${n} minutes studied this week`,
    lessons: (n: number) => `${n} lesson${n === 1 ? '' : 's'} completed`,
    questions: (n: number) => `${n} practice question${n === 1 ? '' : 's'} answered`,
    attentionHeading: 'Could use a bit more practice:',
    noActivity: 'No study sessions logged this week — a quick 10-minute lesson keeps the momentum going.',
    footer: 'You are receiving this because you have an active StudyLegends family account. Manage this in the app under Parent settings.',
  },
  af: {
    subject: 'Julle gesin se week op StudyLegends',
    heading: (name: string) => `Hallo ${name}, hier is hierdie week se vordering`,
    streak: (n: number) => (n > 0 ? `🔥 ${n} dag reeks` : 'Nog geen aktiewe reeks nie'),
    minutes: (n: number) => `${n} minute geleer hierdie week`,
    lessons: (n: number) => `${n} les${n === 1 ? '' : 'se'} voltooi`,
    questions: (n: number) => `${n} oefenvraag${n === 1 ? '' : 'e'} beantwoord`,
    attentionHeading: 'Kan bietjie meer oefening gebruik:',
    noActivity: 'Geen leersessies hierdie week nie — ’n vinnige 10-minute les hou die momentum aan die gang.',
    footer: 'Jy ontvang hierdie omdat jy ’n aktiewe StudyLegends-gesinsrekening het. Bestuur dit in die app onder Ouer-instellings.',
  },
} as const

function renderEmailHtml(parentName: string, learners: LearnerDigest[], lang: 'en' | 'af'): string {
  const s = STRINGS[lang]
  const sections = learners
    .map((l) => {
      const attention =
        l.attentionTopics.length > 0
          ? `<p style="margin:8px 0 0;color:#475569;">${s.attentionHeading} ${l.attentionTopics.join(', ')}</p>`
          : ''
      const body = l.hadActivity
        ? `<p style="margin:4px 0;color:#475569;">${s.minutes(l.minutesThisWeek)} · ${s.lessons(l.lessonsCompleted)} · ${s.questions(l.questionsAnswered)}</p>`
        : `<p style="margin:4px 0;color:#475569;">${s.noActivity}</p>`
      return `
        <div style="margin:16px 0;padding:16px;border-radius:16px;background:#f8fafc;">
          <p style="margin:0;font-weight:700;color:#0f172a;">${l.displayName}</p>
          <p style="margin:4px 0;color:#0d9488;font-weight:600;">${s.streak(l.streak)}</p>
          ${body}
          ${attention}
        </div>`
    })
    .join('')

  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
      <h1 style="font-size:20px;color:#0f172a;">${s.heading(parentName)}</h1>
      ${sections}
      <p style="margin-top:24px;font-size:12px;color:#94a3b8;">${s.footer}</p>
    </div>`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
    return jsonResponse({ error: 'unauthorized' }, 401)
  }

  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) return jsonResponse({ error: 'feature_not_configured' }, 503)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const since = startOfWeekIso()
  const { data: parents } = await supabase.from('parents').select('id, full_name, email, preferred_language')
  if (!parents) return jsonResponse({ error: 'no_parents_found' }, 500)

  let sent = 0
  let skipped = 0
  let errors = 0

  for (const parent of parents) {
    const { data: learners } = await supabase
      .from('learners')
      .select('id, display_name')
      .eq('parent_id', parent.id)
    if (!learners || learners.length === 0) {
      skipped++
      continue
    }

    const learnerDigests: LearnerDigest[] = []
    for (const learner of learners) {
      const [{ count: lessonsCompleted }, { count: questionsAnswered }, { data: sessions }, { data: attention }] =
        await Promise.all([
          supabase
            .from('learner_progress')
            .select('id', { count: 'exact', head: true })
            .eq('learner_id', learner.id)
            .eq('status', 'completed')
            .gte('completed_at', since),
          supabase
            .from('assessment_answers')
            .select('id, assessment_attempts!inner(learner_id)', { count: 'exact', head: true })
            .eq('assessment_attempts.learner_id', learner.id)
            .gte('answered_at', since),
          supabase.from('study_sessions').select('duration_seconds, started_at').eq('learner_id', learner.id).order('started_at', { ascending: false }).limit(200),
          supabase
            .from('mastery')
            .select('topic_id, mastery_score, topics(name)')
            .eq('learner_id', learner.id)
            .lt('mastery_score', 60)
            .order('mastery_score', { ascending: true })
            .limit(2),
        ])

      const weekSessions = (sessions ?? []).filter((sess) => sess.started_at >= since)
      const minutesThisWeek = formatMinutes(weekSessions.reduce((sum, sess) => sum + (sess.duration_seconds ?? 0), 0))

      const practisedDates = new Set((sessions ?? []).map((sess) => sess.started_at.slice(0, 10)))
      const cursor = new Date()
      cursor.setUTCHours(0, 0, 0, 0)
      const todayKey = cursor.toISOString().slice(0, 10)
      if (!practisedDates.has(todayKey)) cursor.setUTCDate(cursor.getUTCDate() - 1)
      let streak = 0
      while (practisedDates.has(cursor.toISOString().slice(0, 10))) {
        streak++
        cursor.setUTCDate(cursor.getUTCDate() - 1)
      }

      learnerDigests.push({
        displayName: learner.display_name,
        streak,
        minutesThisWeek,
        lessonsCompleted: lessonsCompleted ?? 0,
        questionsAnswered: questionsAnswered ?? 0,
        attentionTopics: (attention ?? []).map((row) => (row as { topics?: { name?: string } }).topics?.name).filter((n): n is string => Boolean(n)),
        hadActivity: weekSessions.length > 0,
      })
    }

    const lang = parent.preferred_language === 'af' ? 'af' : 'en'
    const html = renderEmailHtml(parent.full_name, learnerDigests, lang)

    try {
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'StudyLegends <noreply@studylegends.co.za>',
          to: parent.email,
          subject: STRINGS[lang].subject,
          html,
        }),
      })
      if (emailResponse.ok) {
        sent++
      } else {
        errors++
      }
    } catch {
      errors++
    }
  }

  return jsonResponse({ sent, skipped, errors })
})
