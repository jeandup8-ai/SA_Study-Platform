# StudyLegends — product design audit and implementation plan

Audited 2026-09-29 against `main` @ `d7ddada`. Every statement below is
from reading the repository, not from assumption; where something needs to
be seen rendered before it can be called a defect, it says so.

---

## 0. What the product actually is

| | |
|---|---|
| Framework | Vite + React 19 + TypeScript, `react-router-dom` v7 |
| Styling | Tailwind v4, **CSS-first** — all tokens live in `src/index.css` under `@theme`. There is no `tailwind.config.ts` |
| Class merging | `clsx` only. **No `tailwind-merge`** — conflicting utilities passed via `className` resolve unpredictably, which is why components take `tone`/`variant` props instead |
| Icons | `lucide-react` |
| Fonts | Body: Atkinson Hyperlegible (accessibility typeface). Display: Outfit, headlines only |
| Data | Supabase (Postgres + RLS + Edge Functions). Auth via `AuthContext`, active learner via `LearnerContext` |
| Accounts | Parent owns the account; learners are profiles under it. Three shells: `ChildShell`, `ParentShell`, `AdminShell`, plus `MarketingShell` |
| Payments | PayFast, `subscription_plans` read live — **no price is hardcoded anywhere in the UI** |
| PWA | `vite-plugin-pwa`, 60 precached entries (~1.7 MB) |
| Deploy | Netlify from `main` |

**Routes** — 12 public (`/`, `/pricing`, `/practice/*` ×4, 4 legal, `/contact`,
`/sign-in`, `/sign-up`), 2 onboarding, 9 learner (`/app/*`), 3 parent
(`/parent/*`), 7 admin (`/admin/*`).

**Baseline quality gates, run before any change:**

- `npx tsc -b --noEmit` — clean
- `npx oxlint` — 0 errors, 6 pre-existing warnings (4 × fast-refresh, 2 × exhaustive-deps)
- `npx vite build` — succeeds in 4.16 s

---

## 1. Current design inconsistencies

The important finding is **not** that there is no design system. There is
one, it is coherent, and the landing page is already its source of truth.
The finding is that **adoption stopped roughly a third of the way through
the product.**

`src/index.css` already defines: seven colour families (`brand` teal for the
app, `ink`/`volt`/`gold`/`lilac` for marketing, plus semantic
success/warning/danger), the display/body type pairing, and an application
design layer — `.app-canvas`, `.glass-bar`, `.card-lift`, `.skeleton`,
`.stagger-in` — all with a `prefers-reduced-motion` escape.

Who actually uses it:

| Screen | canvas | PageHeader | useAsync | Skeleton | Empty/Error | Stagger | card-lift |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Learner dashboard | shell | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Subjects | shell | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Topic list | shell | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Lesson list | shell | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Progress | shell | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Achievements | shell | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| **Lesson** | shell | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Scan my work** | shell | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Exam prep** | shell | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Mock test** | shell | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Parent dashboard** | shell | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Parent settings** | shell | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Subscription** | shell | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Practice hub/grade/subject/test** | ❌ | ❌ | ❌ | partial | ❌ | ❌ | ❌ |
| **Admin ×7** | shell | ❌ | 1 of 7 | ❌ | ❌ | ❌ | ❌ |

So: **the two most important screens in the product — the lesson and the
upload flow — are the two that never got the treatment.**

**The structural defect: there is no desktop or tablet layout.**
Thirteen screens are capped at `max-w-lg` (512 px). On a 1440 px monitor the
entire learner app is a phone-width column floating in the middle of the
screen. Mobile-first was implemented as mobile-only. The marketing site, by
contrast, uses `max-w-6xl` with real `lg:` grid breakpoints — it is the only
part of the product that has been designed for a large screen.

---

## 2. Design tokens required

Present and good: colour families, semantic colours, the display/body pair,
the motion vocabulary, canvas/glass/lift/skeleton/stagger.

Absent as tokens, and therefore re-invented per file — this is the mechanism
by which the product drifts:

| Token group | Current state | Needed |
|---|---|---|
| Container widths | 13 × `max-w-lg`, 8 × `max-w-6xl`, 7 × `max-w-3xl`, 6 × `max-w-2xl`, 4 × `max-w-4xl`, 3 × `max-w-xl`, 4 × `max-w-md`, 4 × `max-w-sm`, 4 × `max-w-xs`, 1 × `max-w-44` | Three named widths: `--width-reading`, `--width-app`, `--width-wide` |
| Radius | `rounded-xl` / `-2xl` / `-full` chosen ad hoc | `--radius-control`, `--radius-card`, `--radius-panel` |
| Shadow | One-off `shadow-*` and an inline `box-shadow` in `.card-lift` | `--shadow-card`, `--shadow-raised`, `--shadow-overlay` |
| Icon sizing | Literal `size={20}` / `22` / `13` at call sites | `--icon-sm/md/lg` |
| Z-index | Literal `z-20`, `z-50` | Named layers for nav / sticky / overlay / toast |
| Spacing | Tailwind default scale, used consistently enough — no change needed | — |

---

## 3. Components requiring standardisation

Already exist in `src/components/ui`: `Button`, `Card` (+ `cardTones`),
`Badge`, `ProgressRing`, `LearnerAvatar`, `Skeleton`/`SkeletonCard`/
`SkeletonList`, `EmptyState`, `ErrorState`, `PageHeader`/`SectionLabel`,
`Stagger`, `StatTile`.

Exist only as inline markup, duplicated or absent:

| Needed | Today |
|---|---|
| `LessonStepFrame` | Inline in `LessonPage.tsx` — a bare progress bar plus an `<h1>`; 675 lines, one component |
| `StudyAssistantPanel` | `TutorChip` is a private function inside `LessonPage.tsx`. The AI assistant has no identity of its own anywhere in the product |
| `UploadZone` | Two hand-rolled `<label>`+`sr-only`-input blocks in `ScanMyWorkPage.tsx` |
| `FeedbackPanel` | Inline in `QuestionRunner` |
| `ContinueLearningCard` | Inline on the dashboard |
| `SubjectCard` / `TopicCard` | Inline in `SubjectsPage` / `TopicListPage` |
| `MasteryBadge` | Mastery rendered as ring + raw text, varies per page |
| `Toast` | None. Feedback is inline text only |
| `Modal` | Radix `Dialog` used directly, styled per call site |

---

## 4. Pages requiring visual redesign — ranked

1. **`/app/lessons/:id`** — the product. 675 lines, no shared chrome, phone-width only, AI affordances unbranded.
2. **`/app/scan`** — the differentiator. Five states (`idle`/`checking`/`detecting`/`rejected`/`approved`) all hand-styled; no unsupported-file or retry state distinct from rejection.
3. **`/parent`** — has `PageHeader` and empty/error, but no loading state and no `useAsync`; the calm-and-clear parent register is not yet distinct from the learner register.
4. **`/app/exam`, `/app/exam/:id/mock-test`** — partial and none respectively.
5. **`/parent/settings`, `/parent/subscription`** — plain forms.
6. **`/admin/*`** (7 pages) — internal; lowest priority, but it is where the 151 pending illustrations get reviewed, so the Illustration Studio earns a pass.

**Corrected after a closer read: `/practice/*` needs no work.** The
adoption table above is accurate — those four pages carry none of the
*application* design layer — but that is right, not wrong. They are public,
crawlable marketing surfaces and they already use `MarketingShell`,
`PageHero` and `Section`, which is the other half of the same system. The
only genuine gap there is conversion (§7), not visual consistency.

---

## 5. Illustration assets

The three-level architecture the brief asks for is **already half-built**,
and level C is the one that exists:

- **Level C — topic illustrations.** A full pipeline: prompt builder
  (`supabase/functions/generate-topic-illustration/prompt.ts`, 224 topics,
  each with a topic-specific scene, verified by
  `scripts/check-illustration-prompts.mjs` on every build), generation,
  human review gate, and rendering. **151 of 224 generated**, all pending
  review. Blocked only on OpenAI account credit.
  Rendered in exactly two places: `TopicListPage` thumbnails and the
  `visual_explanation` step of a V2 lesson.
- **Level B — subject visual worlds.** **Does not exist.** Subjects are
  distinguished by a lucide icon and a colour (`src/lib/marketing/subjects.ts`).
  This is the highest-value illustration work remaining: 8 assets covering
  every subject, versus 224 covering every topic.
- **Level A — brand illustrations.** **Does not exist, deliberately.** The
  marketing site renders a real product UI in a phone frame
  (`components/marketing/ProductUi.tsx`) instead of illustration. Per the
  brief's own §25 that is the better choice — it shows the product rather
  than describing it — so Level A should stay small: empty states and
  onboarding, not heroes.

---

## 6. Mobile UX issues

Verified by reading:

- No horizontal-overflow risk from fixed widths; everything is fluid or
  capped.
- Touch targets: `min-h-12` on inputs, `min-h-14` on primary buttons, bottom
  nav items are full-height flex children. Good.
- `safe-bottom` / `safe-top` utilities exist and the learner nav uses them.

Needs rendering to confirm, during implementation:

- Lesson step content at 360 px — the step title plus progress bar plus card
  stack has never been measured.
- The scan flow's preview image at 360 px.
- Parent dashboard tables.

---

## 7. Conversion

The landing page answers most of the eight questions already — hero,
`CoreFlow` (how it works), `Subjects`, `ForParents`, `Safety`, `Progress`,
`AiTutor`, `LocalPositioning`, `PricingSection`, `FinalCta`. Pricing reads
live from `subscription_plans`.

Gaps: no explicit *"what happens after I sign up"* step, and the
practice-test pages — the largest organic-search surface in the product —
carry no consistent conversion path back to the trial.

**Pricing note.** The brief states R129/R1099. That contradicts the
correction given earlier in this engagement: **R149/month, R1,199/year**.
Nothing in the UI hardcodes a price, so this needs no code change; I have
not applied the brief's figure.

---

## 8. Trust

Already truthful and present: four legal instruments carrying a
reviewed-on line, a safety note in the scan flow, human review gates on
video and illustration content, parent-owned learner accounts.

No certification, accreditation, POPIA-compliance or DBE-approval claim
appears anywhere, and none will be added.

---

## 9. Accessibility issues

Found by reading:

- **Lesson progress is communicated by a coloured bar alone.** No
  `role="progressbar"`, no value, no "step N of M" text. A screen-reader
  user cannot tell where they are in a lesson. Violates the brief's own §21.
- Decorative illustrations correctly carry `alt=""`.
- Icon-only controls carry `aria-label` (checked: lesson back button).
- Focus states rely on Tailwind defaults in several places rather than the
  `focus:border-brand-500` treatment used on `.input`.

---

## 10. Implementation order

Sequenced so that each step is shippable on its own and nothing is left
half-converted.

1. **Tokens** — add the missing container/radius/shadow/icon/z-index tokens
   to `@theme`. No visual change; this is the substrate.
2. **Responsive container** — replace the 13 `max-w-lg` caps with a
   `--width-app` token that widens at `sm`/`lg`. Gives the learner app a
   tablet and desktop layout for the first time.
3. **Lesson page** — extract `LessonStepFrame`, add the accessible step
   indicator, brand the assistant affordances as `StudyAssistantPanel`.
4. **Scan my work** — extract `UploadZone`, give each of the five states a
   proper empty/analysing/success/rejected/retry treatment.
5. **Parent surface** — skeletons on the dashboard; settings and
   subscription onto the shared chrome.
6. **Practice pages** — one consistent trial CTA. (Visual work dropped; see
   the correction under §4.)
7. **Level B subject illustrations** — 8 assets, specified in
   `IMAGE_GENERATION_MANIFEST.md` with a shared style lock, rendered on
   subject cards and subject heroes.
8. **Exam prep, mock test, admin Illustration Studio.**
9. **Render audit** at 360 / 390 / 430 / 768 / 1440 px, then the full gate:
   typecheck, lint, build.

Steps 1–2 change every learner screen at once and are the highest
value-per-line in the list. Step 7 is the only step that needs image
generation, and it needs 8 images, not 224.

---

## Progress

| Step | State |
|---|---|
| 1. Tokens | **Done** (`4927272`) |
| 2. Responsive containers | **Done** (`4927272`) |
| 3. Lesson page | **Done** — `StepProgress`, `GuidedHelp`, merged action lists (`4927272`); `useGuidedHelp` extracted, 629 → 516 lines (`2f2e0be`) |
| 4. Scan my work | **Done** (`0975504`) |
| 5. Parent surface | **Done** — dashboard skeleton (`4d7f0cb`); settings and subscription onto the shared chrome, three real defects fixed (`2f2e0be`) |
| 6. Practice conversion | **Done** — one `PracticeUpsell` on hub, grade and subject (`d9ae423`) |
| 7. Level B subject illustrations | **Architecture done, images not generated** — registry, `SubjectMark`, manifest for 10 images (`2a6bd54`) |
| 8. Exam / mock test / Illustration Studio | **Done** (`67a3d4c`, `94e468a`) |
| 9. Full render audit | **Done** — 360/390/430/768/1440 across six surfaces, English and Afrikaans |

### Render audit result

No horizontal overflow and no JavaScript errors at any of the five widths,
on any of six surfaces (component harness in both languages, landing,
practice, pricing, sign-up), including with a deliberately long learner
name and the longest real CAPS topic name.

One touch-target regression found and fixed: the Guided help chips were
36 px tall, below a comfortable target for a child. Now 44 px.

Remaining sub-40px targets are all pre-existing and all inline text
links — the visually-hidden skip link, the header wordmark, footer links,
and "Sign in instead". WCAG 2.5.8 exempts inline links, and rebuilding a
footer out of 44 px blocks would be worse than the problem.

### Reproduced defects fixed along the way

The same mistake had been made in four places: state initialised to a
value indistinguishable from a real answer, so the empty case rendered
before the data arrived.

| Where | What a user saw |
|---|---|
| Parent dashboard | "0 lessons, 0 questions, 0 minutes studied" for their child |
| Subscription | "There are no plans yet", on the screen where they pay |
| Mock test | "No questions for this subject yet", on every open |
| Subject plans price | **R1199** where the pricing page and Terms both say **R1,199** |

Also: "/mo" and "/yr" were hardcoded English on a bilingual product, and
`QuestionRunner` carried both selection and right/wrong by colour alone.
