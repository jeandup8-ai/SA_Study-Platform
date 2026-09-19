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

- `0048_practice_tests_anon_read_fix.sql` — see the RLS gotcha below.

### State of the content

Grades 4-7 are seeded. **114 tests, 1 824 questions (912 EN + 912 AF)**,
every question carrying its own explanation in both languages.

| Grade | Subject | Tests | EN | AF |
|---|---|---|---:|---:|
| 4 | Mathematics | 8 | 64 | 64 |
| 4 | Natural Sciences | 6 | 48 | 48 |
| 4 | Social Sciences | 8 | 64 | 64 |
| 4 | English Home Language | 5 | 40 | 40 |
| 4 | Afrikaans FAL | 5 | 40 | 40 |
| 5 | Mathematics | 10 | 80 | 80 |
| 5 | Natural Sciences | 6 | 48 | 48 |
| 5 | Social Sciences | 8 | 64 | 64 |
| 5 | English Home Language | 5 | 40 | 40 |
| 5 | Afrikaans FAL | 5 | 40 | 40 |
| 6 | Mathematics | 7 | 56 | 56 |
| 6 | Natural Sciences | 6 | 48 | 48 |
| 6 | Social Sciences | 6 | 48 | 48 |
| 6 | English Home Language | 5 | 40 | 40 |
| 6 | Afrikaans FAL | 5 | 40 | 40 |
| 7 | Mathematics | 7 | 56 | 56 |
| 7 | Natural Sciences | 4 | 32 | 32 |
| 7 | Social Sciences | 8 | 64 | 64 |
| | **Total** | **114** | **912** | **912** |

Every grade now has at least four subjects, and Grades 4-6 have all five.
Grade 7 still has no English HL or Afrikaans FAL tests -- those are the only
remaining gap in the bank.

Answer positions across the whole bank: 446 / 502 / 499 / 377 for A / B / C
/ D. No position is a giveaway, which is what the rebalancing pass was for.

**Language-subject convention.** In an Afrikaans FAL test the English-language
version asks its question in English but keeps the *options* in Afrikaans,
because the Afrikaans word is the thing being tested. English HL does the
mirror image: the Afrikaans version asks in Afrikaans and keeps the English
options. Follow this or the test stops testing anything.

**EN/AF answer positions may legitimately differ.** 59 tests have the correct
answer in a different position in their English and Afrikaans halves. This is
not a defect -- it is a side effect of the answer-position rebalancing pass,
which shuffled each language independently. Each question's `correct_answer`
still matches its own `is_correct` option (verified at zero mismatches), so
both language versions are internally correct.

Integrity, all verified at zero: questions without exactly one correct
option, duplicate option labels, duplicate sort orders, missing
explanations, `correct_answer` disagreeing with the flagged option, and
Afrikaans `'n` written as a bare `n`.

**Only one test is published** (Grade 5 Maths `place-value`, kept as a live
sample). The other 71 are `REVIEW_REQUIRED` and waiting at
`/admin/practice-tests`.

### Authoring rules learned the hard way

1. **Vary where the correct answer sits.** A first pass put 62% of correct
   answers in position A (712 of 1 152), which a learner can beat without
   knowing anything. Rebalanced to roughly even. When authoring a new batch,
   move the `correct` index around deliberately, then check:
   ```sql
   select o.sort_order, count(*) from questions q
     join practice_test_questions ptq on ptq.question_id = q.id
     join question_options o on o.question_id = q.id and o.is_correct
    group by 1 order by 1;
   ```
   Two exceptions when reshuffling: all-numeric options stay in ascending
   order, and "none of these" / "it depends" options belong last. Watch for
   questions carrying *two* terminal options -- pinning both last collides.
2. **Re-check every option for a second valid answer.** One Grade 6 question
   asked which number divides by 9 and offered both 234 and 567; both do.
   Nothing automated catches this -- only exactly-one-`is_correct` is
   enforced, and that question looked fine by that measure.
3. **After any bulk text repair, resync `questions.correct_answer`.** The
   Afrikaans apostrophe fix rewrote option labels and left 45 rows pointing
   at text that no longer existed.
4. **Topics that need diagrams** cannot become text-only tests: Grade 5
   `views-of-simple3-d-objects`, tessellations, and grid references.
5. **A distractor must be a real candidate.** A Grade 4 punctuation question
   asked which word in "we visited cape town in july." needed a capital and
   offered "the" -- a word that is not in the sentence. Worse, the obvious
   repair ("town") would have made *two* answers correct, because Cape Town
   is two capitalised words. Both problems only surface on a read-back;
   nothing in the schema can see them.
6. **Read the finished test back as a learner would.** Every automated check
   passed on the test above. Rules 2 and 5 are the two failure modes that
   only a human reading the options in order will ever catch.

### Two gotchas that cost time

1. **RLS and `internal.is_admin()`.** A policy of the form
   `using (is_published or internal.is_admin())` fails outright for anonymous
   visitors — `anon` has no EXECUTE grant on the function, and Postgres does
   not promise to short-circuit the OR. Write two separate policies instead
   and scope the admin one `TO authenticated`. Policies are OR'd, so the
   anonymous path never reaches the function. Always verify a public read with
   `set local role anon;` before believing it works.
2. **Afrikaans `'n` and SQL quoting.** The indefinite article is `'n`, which
   breaks single-quoted SQL. Use dollar-quoting (`$json$ ... $json$`) for the
   seed payloads. A repair pass, if needed:
   `regexp_replace(col, '(^|[ (])n ', '\1''n ', 'g')` over prompts,
   explanations, option labels, `title_af` and `summary_af`.

## Environment limits seen this session

- Egress proxy blocks `youtube.com`, `laerskooltoetse.co.za`,
  `laerskoolwiskunde.co.za`, `irainbow.co.za`, `mathmaniax.co.za`, `share.google`,
  `capstutor-info.netlify.app`. `WebSearch` works; direct fetch does not.
- No `SUPABASE_ACCESS_TOKEN` and no secrets API — secrets are set by hand in the
  Supabase dashboard.
- After a deploy, a stale PWA service worker can hide new admin tabs; a full tab
  close and reopen clears it.

## Application design system (new)

The marketing rebuild left the app behind. It now shares the *system* with the
site, not the skin: same display face (`--font-display`, Outfit), same
volt / gold / lilac accents, same motion vocabulary, same reduced-motion
guarantee. The site stays dark (it sells); the app stays light (children use
it for long stretches on cheap phones in daylight). `brand-*` teal is still
the application's primary — changing it would restyle every existing screen
by accident.

- `src/index.css` — `.app-canvas` / `.app-canvas-ink` page washes,
  `.glass-bar` / `.glass-bar-ink` sticky bars, `.card-lift`, `.skeleton`,
  `.stagger-in`. All disabled under `prefers-reduced-motion`.
- `src/components/ui/` — `Skeleton`/`SkeletonList`, `EmptyState`,
  `ErrorState`, `PageHeader`/`SectionLabel`, `StatTile`, `Stagger`,
  tonal `Card` surfaces, `linkCardClass`, a `volt` Button variant.
- `src/hooks/useAsync.ts` — loading / success / error as one state with a
  retry. Before this, screens did `.then(setState)` with no catch: a failed
  request left the page blank forever, and "still loading" looked exactly
  like "genuinely empty".

### Conventions
- `card-lift` is applied only by `PressableCard` and `linkCardClass`, so
  "this lifts when you point at it" reliably means "this is pressable".
- Never wrap `PressableCard` in a `Link` — that nests a button inside an
  anchor. Use `linkCardClass()` on the `Link` instead.
- Card surfaces are a `tone` prop, never a `bg-*` passed via `className`:
  this project uses `clsx`, not tailwind-merge, so the two would collide.
- `check-i18n-keys.mjs` now enforces parity across **all** 651 keys per
  locale, not just `m.*`.

## Illustration Studio

`/admin/illustrations`. Status counts double as filters; grade/subject/search
filters; thumbnail grid; batch generation scoped to whatever the filters show,
with a bounded worker pool (`generateIllustrationsBatch`, default 3, max 6).

`supabase/functions/generate-topic-illustration/prompt.ts` builds a
topic-specific prompt. Two rules matter and are enforced by
`scripts/check-illustration-prompts.mjs` in `prebuild`:

1. **Every topic gets a concrete scene**, not just generic subject direction.
2. **The prompt contains no digits at all** — not "Grade 4", not "aged 9 to
   13", not "15th century". An image that must contain no numerals should not
   be requested by a prompt full of them.

Topic names are CAPS-PDF extraction artefacts and are normalised first
(`normaliseTopicName`): clause numbers, `Topic 2:` prefixes, `(Term 3)`
suffixes and stray digit runs are stripped, `2D` becomes "two dimensions",
and `(Term 2: Emotions)` keeps the qualifier — without that, four distinct
Life Skills topics collapse to one identical name.

**Order in `SUBJECT_DIRECTION` is precedence.** "Social Sciences" contains
the word "science", so the social entry must be tested first or every history
topic asks for laboratory apparatus. Asserted by the check.

`media.generation_prompt` (migration 0049) stores the exact prompt with each
image, so a reviewer rejecting one can see what produced it.

**Not yet run.** All 212 topics still have zero generated illustrations.
Generation needs an admin session and spends real OpenAI credit (~$0.04 an
image, ~$8.50 for all 212), so it is the owner's action from the Studio.

## Open decisions for the owner

1. Curriculum breadth beyond Grade 4–7 CAPS.
2. Whether to add an open-ended AI tutor — this would reverse the
   no-free-text-AI commitment already live in Terms and Privacy.
