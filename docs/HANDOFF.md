# StudyLegends — session handoff

Working notes for picking this up in a fresh session. No credentials in this file.

## What the product is

CAPS-aligned Grade 4–7 learning app for South African families. Vite + React 19 +
TypeScript + Tailwind v4 (CSS-first config in `src/index.css`, **no
`tailwind.config.ts`**), Supabase (Postgres + RLS + Edge Functions), i18next
(`en`/`af`), PWA via `vite-plugin-pwa`, Netlify auto-deploy from `main`.

Supabase project: `dzphkuzhdpzawhucmjzh` (`sa-learning-platform`, eu-west-1).
Repo: `jeandup8-ai/SA_Study-Platform`, working branch `main`.

### Conventions that bite if ignored
- `clsx`, **not** tailwind-merge — conflicting Tailwind utilities are unreliable.
  `Card` hardcodes `border border-slate-200`, so use `ring-2 ring-brand-500` to
  highlight a card rather than `border-*`.
- The theme defines `success-50/500/600/700` and `danger-*`; `success-100` and
  `success-700` do **not** exist as background tokens — check `src/index.css`.
- `internal.is_admin()` lives in a non-exposed schema and guards every admin
  write policy.
- Admin write access to `questions` / `practice_tests` is RLS-enforced.
- i18n plurals use `_one` / `_other` suffixes.
- `mcp__Supabase__generate_typescript_types` returns JSON-wrapped output over the
  token limit — extract with
  `python3 -c "json.load(f)['types']"` into `src/types/database.ts`.

## Billing

PayFast is **live** (not sandbox). Merchant ID, merchant key and passphrase were
provided by the owner and set as Supabase secrets manually via the dashboard —
the Supabase MCP has no secrets API. Sandbox disclosures have been removed from
`/terms`, `/privacy` and `/refund-policy`.

## Video suggestions feature (built, partly reviewed)

- `0042_topic_videos.sql`, `0043_topic_videos_language.sql` — `topic_videos` with
  `verified boolean default false`, `reviewer_id`, `language`. Public read,
  admin-only writes. 0043 fixed a real clobbering bug where a second-language
  video overwrote the first.
- `src/lib/curriculum/topicVideos.ts` — `fetchVerifiedTopicVideo(topicId, lang)`
  prefers the learner's language, falls back to any verified video.
- `src/components/lesson/TopicVideoPanel.tsx` — youtube-nocookie embed.
- `src/pages/admin/VideoSuggestionsReviewPage.tsx` — keyboard-driven review
  console (A approve / R reject / J,K move), auto-advance, subject filter, and a
  banner for candidates whose sourcing notes flag them for closer attention.

**Coverage:** Natural Sciences 22/22, Social Sciences complete, English HL mostly
complete, Mathematics partial. Afrikaans coverage is thin — only 3 AF videos
(place value, map skills G4, water cycle); repeated searches for Afrikaans
science content failed.

**Standing constraint:** the live Privacy Policy states *"Every video is watched
in full and approved by a human on our team before it can appear to any
Learner."* Claude has no video or audio capability and YouTube is blocked by the
network egress proxy, so Claude must never approve a video — doing so would make
a live public statement false. Two videos were rejected by the owner for poor
audio/accent (both FuseSchool); prefer Khan Academy, Crash Course Kids, SciShow
Kids, FreeSchool, Periwinkle, Twinkl.

## Free practice tests (new — the competitor response)

Modelled on `laerskooltoetse.co.za` / `meerkatskool` (blocked by the egress
proxy; read from owner screenshots + search). Their model: free, ungated,
SEO-indexed, CAPS-aligned tests per grade → subject → topic, with an explanation
at every answer, plus a separate maths-only domain. Grade 5 alone shows ~940
questions across 6 subjects.

**Our gap was never the engine — it was that everything is behind a login, and
the bank held 8 questions total.**

### Shipped
- `0045_seo_slugs.sql` — `slug` on `subjects` (unique) and `topics` (unique per
  subject+grade), backfilled via `internal.slugify`; partial index on `questions`
  for the public lookup.
- `0046_practice_tests.sql` — `practice_tests` + `practice_test_questions`.
  Deliberately a **curated layer over topics, not topics themselves**: raw topic
  names are CAPS-PDF extraction artefacts (`"1.1. Whole numbers DIVISION"`,
  `"The place value of: a) b) c) d)"`) and must never become public URLs. RLS
  exposes published rows to anonymous visitors; writes are admin-only.
- `0047_practice_test_seed_helper.sql` — `internal.upsert_practice_test(jsonb)`.
  Takes a whole bilingual test as one JSON document, resolves grade/subject/topic
  by slug, is idempotent, and lands questions as `REVIEW_REQUIRED`.
- Public routes (no auth guard): `/practice`, `/practice/grade-:n`,
  `/practice/grade-:n/:subjectSlug`, `/practice/grade-:n/:subjectSlug/:testSlug`.
  The test page renders **all** questions at once (crawlers must read them;
  parents want to skim), marks each on the spot, always shows the explanation,
  and closes with a score + "this score isn't saved" sign-up CTA.
- `src/hooks/useSeo.ts` — per-page title/description/canonical/og + `Quiz`
  JSON-LD, restoring `index.html` defaults on unmount.
- `scripts/generate-sitemap.mjs` — `prebuild` step, enumerates every published
  practice URL from the DB; skips silently when env vars are absent.
- `src/pages/admin/PracticeTestsPage.tsx` — review a whole test at a time with
  options, correct answer and explanation visible. Publishing is blocked for any
  question without exactly one correct option, and approving a test flips its
  questions to `PUBLISHED` in the same action.

### State of the content
One test seeded and verified: Grade 5 Mathematics `place-value`, 3 EN + 3 AF,
zero integrity errors, **not yet published**. Everything else is still to author.

### Next step
Author tests batch by batch with `internal.upsert_practice_test`, then have a
human publish them from `/admin/practice-tests`. Suggested order by search
demand: Grade 4–7 Mathematics, then Natural Sciences, then English HL, then
Social Sciences. Target ~8–10 questions per test, EN and AF wherever possible.

Payload shape:

```json
{
  "grade": 5, "subject": "mathematics", "slug": "place-value",
  "sort_order": 1, "topic_slug": "place-values",
  "title_en": "...", "title_af": "...",
  "summary_en": "...", "summary_af": "...",
  "questions": [
    { "lang": "en", "difficulty": "easy", "prompt": "...",
      "options": ["a", "b", "c", "d"], "correct": 2, "explanation": "..." }
  ]
}
```

`correct` is a 0-based index into `options`. `difficulty` is `easy|medium|hard`.

## Environment limits seen this session

- Egress proxy blocks `youtube.com`, `laerskooltoetse.co.za`,
  `laerskoolwiskunde.co.za`, `irainbow.co.za`, `mathmaniax.co.za`, `share.google`,
  `capstutor-info.netlify.app`. `WebSearch` works; direct fetch does not.
- No `SUPABASE_ACCESS_TOKEN` and no secrets API — secrets are set by hand in the
  Supabase dashboard.
- After a deploy, a stale PWA service worker can hide new admin tabs; a full tab
  close and reopen clears it.

## Open decisions for the owner

1. Curriculum breadth beyond Grade 4–7 CAPS.
2. Whether to add an open-ended AI tutor — this would reverse the
   no-free-text-AI commitment already live in Terms and Privacy.
