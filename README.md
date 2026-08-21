# Study — South African AI Learning Platform (Grade 4–7)

A mobile-first, child-safe personal tutor for South African learners in Grade 4–7,
built around the CAPS curriculum. Parents own the account; children get a simple,
encouraging, ad-free learning environment. See the full product spec this repo
implements for context on scope and intent.

**This is a foundation build.** It stands up the full architecture — database,
auth, curriculum model, lesson engine, mastery tracking, moderation pipeline,
exam prep, parent dashboard, and an admin base — with a small set of hand-written
demo lessons so the entire learner journey can be exercised end-to-end. It is
explicitly not a finished commercial product: see "Status" below for exactly
what's real, what's mocked, and what's still needed before launch.

## Stack

- React 19 + TypeScript (strict) + Vite
- Tailwind CSS v4
- React Router
- Supabase (Postgres, Auth) with Row Level Security — dedicated project, isolated
  from any other product's database
- react-i18next for internationalisation
- vite-plugin-pwa for installability/offline shell
- Netlify hosting (config included, not yet deployed)

## Getting started

```bash
npm install
cp .env.example .env   # already pre-filled with the dev Supabase project's public URL/key
npm run dev
```

The Supabase publishable/anon key in `.env.example` is safe to commit — it's a
public, RLS-constrained key by design, not a secret. The **service role key is
never used client-side and is not present anywhere in this repo.**

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build for production |
| `npm run typecheck` | Type-check only, no emit |
| `npm run lint` | Lint with oxlint |
| `npm run format` | Format with Prettier |

## Project structure

```
src/
  components/   Design system (ui/), layout shells, lesson-specific components
  context/      Auth (parent) and active-learner React context
  i18n/         react-i18next setup + locale resource files
  lib/          Supabase client, curriculum/mastery/moderation/exam query modules
  pages/        Route-level pages, grouped by area (marketing, auth, onboarding,
                dashboard, subjects, lessons, scan, parent, exam, admin)
  types/        Generated Supabase types + friendly aliases
supabase/
  migrations/   Numbered SQL migrations — schema, RLS, and demo-content seeds
```

## Architecture notes

- **Curriculum model** is `curricula → grades → terms → subjects → topics →
  subtopics → lessons → lesson_content / media / questions`, with grades and
  subjects joined via `grade_subjects` rather than hard-coded — adding Grade
  8–12 or a second curriculum (e.g. IEB) is new rows, not new tables.
- **Language** is a column (`language_code` enum, all 11 official SA languages)
  on every content table (lessons, lesson_content, questions, media). Only
  English and Afrikaans ship real translations and are user-selectable today
  (`src/i18n/languages.ts`); the other nine are wired into the type system and
  UI-ready, gated by an `available: false` flag until reviewed translations
  exist. No schema or component change is needed to turn one on.
- **Media** is a generic catalogue (`media_type`, `provider`, `url`/`embed_url`,
  `approval_status`, `source`, licensing fields) — never tied to one
  video-generation vendor. Today it's populated with hand-built SVG/CSS/React
  animation components (`src/components/lesson/*Animation.tsx`), selected by
  `media.source`. External video rows would need `approval_status = 'approved'`
  before a child ever sees them; there is no live/unrestricted video search.
- **Learners have no login credentials.** Only parents authenticate (Supabase
  Auth). This is deliberate: less PII, nothing for a child to leak, and no
  child-facing auth surface to secure. Profile switching is local (a "which
  child" selector), not a second identity.
- **RLS is default-deny.** Curriculum/content tables are public-read,
  admin-write only. Every learner-owned table (`learner_progress`, `mastery`,
  `assessment_attempts`, `subscriptions`, `moderation_logs`, …) is scoped by
  re-deriving ownership through a join back to `learners.parent_id = auth.uid()`
  inside the policy — never by trusting a client-supplied `learner_id` column.
  See `supabase/migrations/0005_row_level_security.sql`.
- **Mastery** is an exponential moving average over quiz results (`src/lib/
  mastery/engine.ts`), with a coarse weakness-signal heuristic (`score < 60`).
  This is an honest starting point, not the spec's more ambitious goal of
  inferring *why* a learner is struggling (e.g. place-value underlying a
  multiplication error) — that needs either large-scale learning-objective
  tagging or an LLM-backed classifier, and is future work.

## Status: implemented vs. mocked vs. pending

**Implemented and working end-to-end** (verified via direct Supabase queries and
a real-browser render pass; see the note on browser testing below):
parent sign-up/sign-in, learner profile creation, curriculum-driven child
dashboard, subject/topic/lesson browsing, the full 10-step lesson flow with
real SVG/CSS animated demos, practice questions and a mini-quiz drawn from the
question bank, mastery scoring, exam-readiness computation from mastery data,
mock tests, the parent dashboard (weekly stats, subject breakdown, attention
needed), RLS-enforced data isolation, and a read-only admin overview.

**Mocked / deliberately simplified — clearly labelled in the code and UI:**
- **Content moderation** now runs server-side, for real, in a Supabase Edge
  Function (`supabase/functions/moderate-upload/`) — the client never decides
  what's safe. Two checks are genuinely live in production terms, not stubs:
  file-type/size validation (re-checked server-side, independent of whatever
  the client already did) and real EXIF GPS metadata extraction (a photo with
  embedded location data is rejected). The vision-safety scan (nudity, weapons,
  drugs, gore, offensive content) calls Sightengine and is fully wired up, but
  is *inert* until `SIGHTENGINE_API_USER` / `SIGHTENGINE_API_SECRET` are set as
  Edge Function secrets — no such account/credentials exist in this project.
  Until then the function still runs and returns `visualSafetyChecked: false`
  so the UI can say so honestly rather than pretending a scan happened; the
  Scan My Work screen and the admin moderation log both surface this flag. Any
  provider failure or network error **fails closed** (rejected, never silently
  approved). PII-in-image detection (addresses, phone numbers, ID documents,
  identity numbers) is not implemented — that needs OCR plus a PII classifier,
  a larger follow-up. The UI keeps a "simulate an unsafe upload" toggle so the
  rejection UX is demonstrable without live provider credentials. Swapping in a
  different vision provider (AWS Rekognition, Google Cloud Vision SafeSearch,
  Hive, etc.) means changing the `checkWithSightengine` call and env var names
  inside that one Edge Function file — nothing in the client changes.
- **Scan My Work's "what is this about"** step asks the learner to pick a
  subject rather than claiming to auto-detect it from the photo — there's no
  OCR/vision AI wired up, and pretending otherwise would be dishonest.
- **AI tutor actions** ("explain again", "make it easier", "show an example")
  are content-driven (a second, simpler `lesson_content` row per lesson), not
  an LLM. No general-purpose chatbot exists anywhere in the product, by design.
- **Payments**: `subscriptions`/`subscription_plans` tables and a trial-start
  flow exist; no payment provider is connected, and the UI says so explicitly.
  Illustrative ZAR prices are seeded data, not finalised commercial pricing.

**Requires API credentials (not present in this repo):**
- ~~A Sightengine account~~ — done: `SIGHTENGINE_API_USER` / `SIGHTENGINE_API_SECRET`
  are set as Edge Function secrets on project `dzphkuzhdpzawhucmjzh` (never
  committed here). Not yet confirmed live via a real upload — check the
  `moderate-upload` function logs after the next real Scan My Work attempt for
  `visualSafetyChecked: true` before relying on it.
- A South African payment provider (Paystack / PayFast / Peach Payments, etc.).
- An LLM provider, if/when the tutor's "explain again" family of interactions
  is upgraded from content-driven to genuinely adaptive.
- A video-generation provider, if/when `media` rows should include produced
  video rather than only the built-in SVG/React animations.

**Known operational follow-ups:**
- **Email confirmation** was switched OFF in the dashboard (Authentication →
  Providers → Email) to unblock testing, after the project's default built-in
  email sender's rate limit (a handful of emails/hour) broke back-to-back test
  signups. That's a manual dashboard setting outside anything the Supabase MCP
  toolset or this repo can change. **Before real users sign up**, either
  connect a real SMTP provider (Resend, Postmark, SendGrid, etc. under
  Authentication → Settings → SMTP Settings) and re-enable confirmation, or
  make a deliberate, informed call to launch without email verification (not
  recommended from an account-recovery/security standpoint).
- **Supabase API key format**: use the *legacy* anon (JWT) key for
  `VITE_SUPABASE_PUBLISHABLE_KEY`, not the newer `sb_publishable_...` key —
  the newer format returned 401s on direct PostgREST calls from the deployed
  app (confirmed via Supabase's edge logs), while the legacy JWT key works
  correctly. Both `.env.example` and the Netlify site's env vars now use the
  legacy key; if API calls ever start 401ing again after rotating keys,
  check this first.

**Requires human content review before real use:**
- All lesson/topic/question content is marked `is_demo_content = true` and is
  illustrative only — grade/subject *structure* follows the well-known public
  CAPS phase layout, but no lesson text or question has been checked against
  an official CAPS document. **Do not treat any seeded content as verified
  curriculum material.**
- **Afrikaans coverage, precisely:** the UI chrome (167/167 i18n keys, every
  page) and every structural/navigational label — grade names, term names,
  all 10 subject names, the 3 seeded demo topic names — have an Afrikaans
  string and switch automatically (see below). What's *not* translated at
  scale is lesson body content: only one demo lesson ("Understanding
  Fractions") has a full Afrikaans version; the rest of the demo lessons
  fall back to English when a learner's language is Afrikaans
  (`fetchLessonsForTopic`'s built-in fallback). None of this — UI strings,
  subject/topic names, or the one Afrikaans lesson — has been reviewed by a
  native speaker; get a review pass before shipping.
- **How language switching actually works:** `applyLanguagePreference()`
  (`src/i18n/index.ts`) is called whenever the signed-in parent's row loads
  (`AuthContext`) and whenever the active child profile changes
  (`LearnerContext`) — so the parent's own screens follow
  `parents.preferred_language` and a child's learning screens follow that
  specific child's `learners.preferred_language`, switching automatically
  when a parent flips between two children who each picked a different
  language. Structural labels (`grades.name_af`, `subjects.name_af`,
  `topics.name_af`, etc. — migration `0021`) are a separate mechanism from
  the per-language `lessons`/`questions` rows already in the schema, since
  these are short platform labels, not authored content;
  `src/lib/i18n/localizedName.ts` picks `name_af` when set, falling back to
  `name` otherwise, so a missing translation never renders blank.

**Note on this build's browser testing:** the sandbox this was built in blocks
outbound network access to `*.supabase.co` from anything other than the
Supabase MCP tool itself (org egress policy, confirmed via a 403 on both a
raw `curl` and a real headless-Chromium run). Static/client-only rendering
(the landing and sign-up pages) was verified in an actual browser with a
real screenshot and zero console errors; the full signed-in flow (lesson →
quiz → mastery → parent dashboard) was verified by confirming the seeded data
and RLS policies directly against the database via SQL, plus a full read of
every page's code, rather than by clicking through it in a browser session.
**Whoever runs this next should do one real click-through in a normal
(non-sandboxed) environment before considering it launch-ready.**

The same restriction applies to the `moderate-upload` Edge Function: it
deployed successfully (confirmed `ACTIVE` and its source was read back and
diffed against what was sent), but could not be invoked from this sandbox to
confirm its live behaviour — `curl` to the function's `*.supabase.co` URL hit
the same 403. The one external dependency inside it (a dynamic `import()` of
the `exifr` npm package via esm.sh, for real EXIF GPS parsing) is wrapped in
try/catch specifically so a failure to load it degrades to "skip the GPS
check" rather than crashing the whole function — but this has not been
proven with a live request. **Invoke it once for real before relying on it**:
`supabase functions invoke moderate-upload --project-ref dzphkuzhdpzawhucmjzh
-H "Authorization: Bearer <a signed-in parent's access token>"` with a small
test image attached, and check `visualSafetyChecked` and `reasonCodes` in the
response match expectations.

## Curriculum knowledge base: infrastructure vs. real content

A second build phase added the infrastructure for a real, sourced curriculum
knowledge base — deliberately kept separate from the demo content above,
which stays illustrative and untouched.

**What's real and working:**
- **Schema**: `phases`, `subject_components`, `strands`, `curriculum_outcomes`,
  `curriculum_sources`, `curriculum_versions`, `atp_entries`, `skills`,
  `curriculum_skills`, `question_skills`, `learner_skill_mastery`,
  `terminology`, `exam_plans` (migrations `0013`–`0020`), all RLS-protected
  (public-read, admin-write). `topics`/`learning_objectives`/`lessons`/
  `questions` gained a `content_workflow_status` enum
  (`DRAFT → REVIEW_REQUIRED → VERIFIED → PUBLISHED → ARCHIVED`) and, on
  `topics`/`learning_objectives`, `source_id`/`source_page`/`source_section`
  so every extracted record traces back to a page in an official document.
  CAPS (content requirement) and ATP (yearly pacing) are structurally
  separate tables, never conflated. IEB is **not** a separate curriculum
  entity — it's an `assessment_style` enum (`caps_standard` /
  `ieb_enrichment`) plus skill-tagging on top of the same CAPS topics,
  per the spec's explicit instruction.
- **Import pipeline** (`curriculum-tools/`, a standalone Node/tsx package,
  kept out of the Vite bundle): real PDF (pdfjs-dist, with geometric
  row/column/heading reconstruction), DOCX (mammoth), HTML (cheerio), and
  plain-text parsers, feeding grade/term/topic-candidate detectors and a CLI
  (`npm run import -- --file <path> --document-id <id> [--dry-run]`) that
  writes extracted topics as `REVIEW_REQUIRED` with full source attribution.
  Tested against fixture files (explicitly labelled "NOT OFFICIAL CURRICULUM
  CONTENT") — both parsing and grade/term/topic detection work correctly.
  See `curriculum-tools/README.md` for real capabilities and limitations.
- **Admin review UI**: `/admin/curriculum-sources` (mark a source document
  verified) and `/admin/review-queue` (verify or reject each
  extracted topic against its source page/section) — nothing extracted can
  reach `PUBLISHED` without a human clicking Verify.
- **Terminology verification**: `/admin/terminology` — every subject-vocabulary
  translation sits as unverified until a reviewer confirms it; only
  `verified = true` rows are ever returned to a learner-facing feature or the
  tutor context (`fetchVerifiedTerminology`).
- **Skill-level mastery**: `src/lib/mastery/engine.ts` now updates
  `learner_skill_mastery` (same EMA approach as topic mastery) from
  `question_skills` tags whenever a quiz is recorded. The IEB application
  score shown on the exam prep page (`src/lib/exam/iebReadiness.ts`) is the
  learner's average mastery on just the `application` skill — a platform
  score, explicitly labelled as not an official IEB score.
- **Recommendation engine** (`src/lib/recommendation/nextTopic.ts`), wired
  into the child dashboard's "Recommended For You" card: next un-started
  topic in curriculum order → topic tied to a recent weakness signal → lowest
  attempted mastery → a topic in a subject with an assessment in the next 14
  days → spaced revision of a stale-but-mastered topic. Replaces the earlier
  "lowest-average-subject" heuristic with an actual topic-level suggestion.
- **AI tutor context assembly** (`src/lib/tutor/context.ts`): given a learner
  and topic, assembles grade, subject, topic mastery, lesson, learning
  objectives, this learner's specific recent wrong answers, and verified
  subject terminology in their language — real data, real queries. **There is
  still no LLM wired up anywhere in this codebase.** This is the context
  object a future LLM-backed tutor call would receive; see "AI tutor actions"
  above for what exists today.

### Real CAPS documents: imported 2026-08-21

The product owner supplied 9 real DBE CAPS source PDFs
(`SA_CAPS_Grade4-7_Source_Pack.zip`, covering Mathematics/Life Skills/Natural
Sciences & Technology/Social Sciences for Intermediate Phase and
Mathematics/Natural Sciences/Technology/Creative Arts/Social Sciences for
Senior Phase) — this sandbox still cannot reach `education.gov.za` directly,
but a locally-supplied file needs no network access to parse. Before
extracting anything, every file was verified: SHA-256 + byte count checked
against the supplied `SOURCE_MANIFEST.json` (9/9 passed), and independently
re-checked with `pdfjs-dist` to confirm genuine CAPS document structure
rather than trusting the manifest metadata alone. The files live in
`curriculum/sources/caps/`; the `curriculum_sources` DB rows carry the real
checksums and official URLs (migration `0022`).

**Real, honest outcome of running the import pipeline against them** (see
`curriculum/import-log.json` for the full per-document report):

| Document | Grades extracted | Topic candidates | Status |
| --- | --- | --- | --- |
| Mathematics (Intermediate) | 4, 5, 6 | 45 | `REVIEW_REQUIRED` |
| Life Skills (Intermediate) | 4, 5, 6 | 31 | `REVIEW_REQUIRED` |
| Natural Sciences & Technology (Intermediate) | 4, 5, 6 | 80 | `REVIEW_REQUIRED` |
| Social Sciences (Intermediate) | 4, 5, 6 | 57 | `REVIEW_REQUIRED` |
| Mathematics (Senior) | 7 | 0 | `PARSED` |
| Natural Sciences (Senior) | 7 | 0 | `PARSED` |
| Technology (Senior) | 7 | 0 | `PARSED` |
| Creative Arts (Senior) | 7 | 0 | `PARSED` |
| Social Sciences (Senior) | 7 | 0 | `PARSED` |

213 topic-candidate rows now exist in `topics` with
`content_workflow_status = 'REVIEW_REQUIRED'`, `is_demo_content = false`,
and full source attribution (`source_id`/`source_page`/`source_section`).
**None of this is verified or visible to a learner** — every row needs a
human reviewer at `/admin/review-queue` before it means anything, and the
signal-to-noise ratio genuinely varies:

- Every CAPS document in this pack uses a **different** internal convention
  for marking grade/term sections (`TERM 1 – Grade 4`, `TERM 1 GRADE 4`,
  `GRADE 4: Term 1`, `Grade 4: Intermediate Phase History Term 1`, a grid
  table with grades as columns, or no detectable pattern at all) — there is
  no single regex that reads all of them. The importer's detector
  (`curriculum-tools/src/detectors/curriculumDetectors.ts`) currently
  recognises 3 of these conventions; the 5 Senior Phase Grade-7 documents
  that returned 0 candidates each hit a distinct, real limitation
  (documented per-document in `import-log.json`) — a dense table the PDF
  parser didn't recognise as tabular, a grade-as-table-column layout, or a
  format not yet reverse-engineered.
- Two real bugs were found and fixed while building this: an early version
  matched a document's own contents-page listing ("Grade 4 Term 1", "Grade 4
  Term 2", …) as if it were real section markers, mistagging front-matter
  content with whatever grade/term happened to appear last in that list;
  and running page headers/footers (e.g. "LIFE SKILLS GRADES 4-6" reprinted
  on every page) were being harvested as fake topic candidates until a
  generic repeated-text filter was added (`dropRepeatedRunningText`).
- Even after both fixes, a meaningful share of the extracted records —
  especially from the Natural Sciences & Technology amendment and Social
  Sciences documents — are assessment-appendix scaffolding (cognitive-level
  verb lists, mark-allocation tables) that inherited the last real
  grade/term marker seen before them, not genuine topic names. This is
  flagged explicitly in `import-log.json` rather than silently mixed in.

**What this means practically:** the pipeline is genuinely working against
real official documents end-to-end (parse → grade/term-scope → write
`REVIEW_REQUIRED` with source attribution), but a human reviewer has real
work ahead — sorting 213 candidates of mixed quality, and separately
figuring out extraction for the 5 documents that yielded nothing. Improving
the table-detection heuristic (for the dense 3-column Senior Phase layout)
and building a grade-as-column table reader (for Technology/Human & Social
Sciences) are the two highest-leverage next steps for getting Grade 7
content out of this same source pack. The ATP (Annual Teaching Plan) and
IEB reference documents were not part of this pack and remain `PENDING` in
`curriculum/sources/manifest.json` — do not manufacture ATP information.

## Database

Supabase project: `sa-learning-platform` (a dedicated project, separate from
any other product, precisely because this one holds children's data). Schema
and seed data live in `supabase/migrations/` as numbered SQL files — apply
them in order against a fresh project to reproduce this state. To grant admin
access, insert a row into `admins` directly via the Supabase SQL editor or a
service-role script; this is intentionally not exposed through the client API.

## Security & privacy posture

- No physical address is ever collected.
- No child-to-child communication, public profiles, comments, or social
  features exist anywhere in the product.
- Every table holding personal or learning data has RLS enabled with
  ownership re-derived server-side, not trusted from the client.
- The Supabase publishable key is safe to expose (see above); nothing secret
  is committed. `.env` is gitignored.
