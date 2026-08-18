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
- **Content moderation** (`src/lib/moderation/`): real MIME-type and file-size
  validation, but the actual image-safety scan (nudity, weapons, PII, ID
  documents) is not implemented — no vision-moderation provider is connected.
  The UI has a "simulate an unsafe upload" toggle so the rejection UX is
  demonstrable without a real provider. Swapping in a real one is a single
  file (`mockProvider.ts` → a new implementation of `ModerationProvider`).
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
- A vision/content-safety moderation provider, for real image-safety scanning.
- A South African payment provider (Paystack / PayFast / Peach Payments, etc.).
- An LLM provider, if/when the tutor's "explain again" family of interactions
  is upgraded from content-driven to genuinely adaptive.
- A video-generation provider, if/when `media` rows should include produced
  video rather than only the built-in SVG/React animations.

**Requires human content review before real use:**
- All lesson/topic/question content is marked `is_demo_content = true` and is
  illustrative only — grade/subject *structure* follows the well-known public
  CAPS phase layout, but no lesson text or question has been checked against
  an official CAPS document. **Do not treat any seeded content as verified
  curriculum material.**
- Afrikaans translations (UI strings and the one translated demo lesson) were
  machine-translated by the author of this codebase, not reviewed by a native
  speaker — get a review pass before shipping.

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
