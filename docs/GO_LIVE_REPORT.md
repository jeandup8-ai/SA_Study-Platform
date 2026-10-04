# StudyLegends — go-live readiness report

Pass run 2026-10-04 against `main` at `896fd0f`. Every figure here was
measured during the pass; nothing is carried over from an earlier document
without being re-checked.

## A. Overall status

**GO_LIVE_READY_WITH_DOCUMENTED_LIMITATIONS** — conditional on one owner
action that only the owner can take (§K).

The product is structurally sound: RLS is enforced on all 56 public tables
with no cross-account path found, the child-safety gates are real and
fail-closed, the AI is curriculum-grounded and cannot be used as an answer
machine, and the build is clean. What stops an unqualified GO_LIVE_READY is
not a code defect but one thing requiring human confirmation: a live legal
claim this pass could not substantiate. The subscription-state migration
that was outstanding has since been applied.

### A material limit on this report

**No authenticated flow was exercised in a browser.** This container's
network policy blocks egress to `supabase.co`, so the signed-in product —
dashboard, lessons, practice, scan, parent progress, subscription, admin —
could not be loaded and clicked. Those areas were audited by reading code
and by querying the live database directly through MCP, which is strong for
data access, authorization and logic, and is **not** a substitute for
clicking. Where this report says a signed-in flow is "verified", it means
verified by code and database inspection, and it says so.

Public routes were exercised in real Chromium at five widths.

---

## B. What was fixed

| # | Pri | Fix |
|---|---|---|
| 1 | P1 | **No error boundary existed.** Any render error unmounted the whole React tree and left a white screen with no way back. Added `ErrorBoundary` wrapping the entire route table, with a separate message and reload path for the chunk-load failure that happens to any tab left open across a deploy (routes are `lazy()`-loaded, so stale chunk URLs 404 and the `Suspense` boundary above them cannot catch it). Verified by forcing a throw in a real route. |
| 2 | P2 | **No 404 route.** `<Routes>` matched nothing on an unknown URL and React rendered an empty page — a mistyped address was indistinguishable from a broken product. Added `NotFoundPage` with `path="*"`, in English and Afrikaans. |
| 3 | P2 | **Auth secondary links were 16 px tall** — "Create a parent account" and "Sign in instead", the only alternative action on each auth screen, and the smallest tap targets in the product. Now 44 px (measured in-browser). |
| 4 | P3 | **Topic thumbnails had no intrinsic size**, so rows reflowed as each image arrived. Added `width`/`height`/`decoding`. This fixes layout shift, not bytes — see the payload limitation in §J. |
| 5 | — | Added `npm run check:art:deep`, which decodes declared Level B artwork in Chromium and fails on a translucent body, a feathered halo, or a mark with no clear space. Written in response to the B-01 candidate, which passed the existing header-level check. |
| 6 | P1 | **Applied 2026-10-04:** `subscriptions_no_client_paid_state`, a RESTRICTIVE INSERT policy stopping a client from inserting a paid subscription state. See §F for a correction to the original finding. |

---

## C. What was verified

**Database, by direct query:**

- 56 public tables, **all** with `rowsecurity = true`, all with ≥1 policy. No table without RLS.
- Every learner-data table (`mastery`, `study_sessions`, `learner_progress`, `assessment_attempts`, `assessment_answers`, `tutor_explanations`, `tutor_mindmaps`, `learner_badges`, `learner_points_ledger`, `scan_mistake_feedback`) scopes through `learners` on `l.parent_id = auth.uid()`. No path found for one parent to read another's data, or one learner another learner's.
- `parents` scoped `id = auth.uid()`; `subscriptions` `parent_id = auth.uid()`; `payment_events` and `audit_logs` admin-read-only.
- `media_read` is `approval_status = 'approved' OR internal.is_admin()` — unchanged by this pass.
- `internal.is_admin()` is `SECURITY DEFINER`, `STABLE`, `search_path = public`.
- 11 edge functions deployed and ACTIVE. `verify_jwt = true` on all user-facing ones; `false` only on `payfast-itn` (webhook, signature-verified), `email-unsubscribe` and the two cron jobs.

**Code, by reading:**

- No `console.*`, no `TODO`/`FIXME`, no hardcoded credentials in `src/` or `supabase/functions/`. All PayFast secrets read from `Deno.env.get`. `.env` is gitignored; only `.env.example` is tracked.
- Upload moderation is fail-closed: an error returns `decision: 'rejected'`, and `ScanMyWorkPage` returns before any AI call unless the decision is `approved`. **Blocked content cannot reach the AI.**
- `moderate-upload` re-validates type and size server-side regardless of the client, parses real EXIF GPS, and reports `visualSafetyChecked: false` rather than faking a verdict when no vision provider is configured.

**Browser, real Chromium, 7 routes × 5 widths (390/430/768/1024/1280) = 35 loads:**

- **Zero horizontal overflow** on every load.
- No blank pages; exactly one `<h1>` per page.
- **Zero `pageerror` events.** (Console entries present are `ERR_CERT_AUTHORITY_INVALID` for Google Fonts and `ERR_TUNNEL_CONNECTION_FAILED` for Supabase — this sandbox's network policy, not application faults.)
- The modal-centering fix from the previous pass is intact.
- Sub-12px text on the landing page was investigated and **dismissed**: it is inside the `PhoneFrame` device mockup — a scaled picture of the UI, where 10–11 px is correct.

---

## D. Automated gates

| Gate | Result |
|---|---|
| Typecheck (`tsc -b --noEmit`) | **PASS**, 0 errors |
| Oxlint | **PASS**, 0 errors, 6 warnings (all pre-existing, none in changed files) |
| Production build | **PASS**, built in 2.61s |
| i18n parity | **PASS** — 161 static keys, 22 templated, **660 keys per locale** (was 656; +4 for the 404 page, en/af in parity) |
| Illustration prompts | **PASS** — 224/224 topics with a topic-specific scene |
| Subject artwork | **PASS** — 0 declared, 10 on fallback |
| Topic-art guard | **PASS** — no files in `public/topic-art` |
| Artwork upload validation | **PASS** — 58/58 assertions over 14 real image fixtures |
| Subject art deep check (new, not in prebuild) | **PASS** — nothing declared to inspect |

No test command was invented; the repository has no test runner, and the
`scripts/check-*.mjs` convention was followed.

---

## E. Manual user journey

| Flow | Result | Basis |
|---|---|---|
| Landing page | **PASS** | Browser, 5 widths. Value proposition, grades, pricing link, CTA all present |
| Pricing | **PASS** | Browser. Reads live from `subscription_plans` |
| Legal pages ×4 | **PASS** | Browser, all render, all linked |
| Contact | **PASS** | Browser |
| Sign in / sign up | **PARTIAL** | Pages render correctly at all widths; **submission not exercised** (Supabase unreachable) |
| 404 | **PASS** | Browser, newly added |
| Error recovery | **PASS** | Forced throw caught by the new boundary |
| Parent dashboard, learner creation | **NOT TESTED IN BROWSER** | Code + RLS verified |
| Subject → topic → lesson → practice | **NOT TESTED IN BROWSER** | Code + RLS verified; 217 lessons, 2,024 questions present |
| Upload / moderation / AI | **NOT TESTED IN BROWSER** | Gate order verified in code; fail-closed confirmed |
| Parent progress | **NOT TESTED IN BROWSER** | RLS verified |
| Subscription / cancellation | **PARTIAL** | Code verified; 4 real ITN callbacks processed historically (§H) |
| Admin / Illustration Studio | **NOT TESTED IN BROWSER** | Upload dialog rendered in isolation last pass; RLS verified |

---

## F. Security

Checked: RLS on all tables; learner/parent isolation; admin gating; storage
policies; edge-function JWT settings; secret handling; `.env` tracking;
client-forgeable state; path traversal in the artwork upload; service-role
usage (only `payfast-itn`, `payfast-cancel`'s final step, and the cron
batch job).

### Correction to this report's first version

The first version of this report said `subscriptions` was forgeable on both
INSERT and UPDATE. **Only INSERT was.** UPDATE was already protected by
`internal.protect_subscription_billing_fields()`, a BEFORE UPDATE trigger
that predates this work and raises if any non-`service_role` caller changes
status, plan, trial end, period end, provider fields or `parent_id`. The
audit read the RLS policies and never looked at the triggers, which is how
an existing protection got reported as missing. Flagging it rather than
quietly editing it: the audit method had a gap, and a policy-only read of a
Postgres table is not a complete authorization audit.

**The real finding, now fixed.** `subscriptions_owner_insert` checked only
`parent_id = auth.uid()`, and the existing trigger is BEFORE UPDATE so it
never fired on an insert. Any signed-in parent could insert
`status = 'active'` with a future `current_period_end` straight from the
browser. Small blast radius today — **no learning content is gated on
subscription status**, so it affected the badge on the subscription page and
the `max_learners` cap — and a free lifetime subscription the day a paywall
ships.

**Applied 2026-10-04:** `subscriptions_no_client_paid_state`, a RESTRICTIVE
INSERT policy ANDed with the existing ownership policy, limiting a client
insert to `status in ('trialing','incomplete')` with no client-set paid
period and a trial bounded at 30 days. Nothing was dropped. Verified live:
the policy is present and RESTRICTIVE. Both legitimate callers
(`startTrial`, `payfast-checkout`) name only permitted states, and
`service_role` has BYPASSRLS so the PayFast handlers are untouched.

**One piece of mess, recorded rather than hidden.** A second BEFORE UPDATE
trigger, `subscriptions_guard_billing_fields`, was applied from the first
draft before the existing one was discovered, and this session was not
permitted to drop it again — so both are live. It is redundant, not
harmful: triggers fire alphabetically, `guard_` runs first and lets admins
through, `protect_` runs second and still raises, so the net behaviour is
the stricter pre-existing one for every caller. The drop statements are in
the migration file under "HOUSEKEEPING". It is a tidy-up, not a fix.

**Not verified behaviourally.** The permission layer in this session
declined the test that would have attempted the forgery and the legitimate
inserts against a real row. The policy is confirmed present, RESTRICTIVE,
and correct by inspection of its stored expression — but no insert was
actually attempted.

---

## G. Child safety

Confirmed **absent** (searched, none exist): public learner profiles,
learner-to-learner messaging, friend/follower systems, public posts or
comments, learner video upload, public sharing of learner work, GPS
collection, unrestricted public AI chat.

Confirmed **present**: server-side upload moderation that re-validates
independently of the client; fail-closed rejection; real EXIF GPS detection
and rejection; honest `visualSafetyChecked` reporting rather than a faked
verdict; no physical address collected anywhere.

AI behaviour matches the stated principle. All three AI functions run
server-side on the caller's JWT with closed, curriculum-grounded inputs —
there is no free-text chat surface. The scan path returns *"double-check…"*
guidance capped at 30 words, is instructed never to say "wrong", and
returns `null` rather than inventing a comment. Every prompt forbids
soliciting personal information, suggesting contact with anyone, emitting
links, and claiming to be human. **A learner cannot upload a worksheet and
receive an answer sheet.**

No safety gate was weakened in this pass.

---

## H. Payments — actual state

PayFast is **really integrated, not stubbed.** Stated precisely:

- `payfast-checkout`, `payfast-itn`, `payfast-cancel` are all deployed and ACTIVE.
- Signature generation includes the passphrase; all credentials come from edge-function secrets, none are in the repo.
- **`payment_events` contains 4 rows, all `payment_status = COMPLETE`, all `processed_at` set, dated 2026-09-11.** Real ITN callbacks were received, signature-checked and acted on. I **cannot** tell from the data whether those were sandbox or live transactions.
- `status = 'active'` is written **only** by `payfast-itn` under the service role. Correct.
- Cancellation route exists and works in two steps (user-scoped `cancel_requested_at`, then a service-role status change).
- If secrets are absent the checkout returns `feature_not_configured` and the UI shows a specific message. **No fake success state exists anywhere.**

Current data: 10 subscription rows, **0 active**, 3 parents, 2 learners.

**Live pricing is R149/month and R1,199/year**, read from `subscription_plans`, with a 3-day trial from a single `TRIAL_DAYS` constant. The brief specified R129/R1099; the live implementation explicitly differs, so per the brief's own instruction it was left unchanged. This matches your earlier correction.

**Entitlement reality:** there is **no paywall**. All learning content is available to any signed-in user regardless of subscription. That is a commercial decision, not a defect — but it means "subscription" currently buys nothing enforced, and the launch model must either accept that or add a gate (which must read server-side state, and must not ship before migration 0051).

---

## I. Artwork

**Level B — 0 of 10 declared.** All ten subjects render the gradient-and-glyph fallback, which is the intended finished-looking state. A missing image breaks nothing.

**B-01 Mathematics candidate: REVIEW_REQUIRED, not approved, not shipped.** Assessed in full and recorded in `docs/LEVEL_B_01_MATHEMATICS_SPEC.md` § Review log. It contains every required object and none of the prohibited stationery, and looks good at 128 px. It is not approved because it **fails the squint test at 40–64 px**, the sizes it actually renders at — the objects collapse into an unreadable cluster. Also measured: only 0.5% of pixels fully opaque (48.5% partial alpha — background-removed rather than rendered on transparency), a ground plane with contact shadows, a glossy finish against a matte style lock, a level rather than tipped balance, and a 5.6% right margin against the required 10%. One honest correction: the translucency reads worse in numbers than on screen, because the artwork is cyan and so is the Mathematics gradient — the halo is invisible *on this subject*. The squint failure is what blocks it. **No file was added and no registry entry was changed.**

**Level C — unchanged by this pass, as instructed.**

| | |
|---|---|
| Existing images | **151** |
| Pending | **151** |
| Approved | **0** |
| Rejected | **0** |
| Learner-visible today | **0** |
| Need human visual review | **86** |
| Retained, reclassified | **65** |
| Genuinely missing | **56** |
| `VISUAL_NOT_NEEDED` | 51 |
| `SOURCE_INCOMPLETE` | 31 |
| Upload workflow | **Built and gate-verified.** Admin-only, `topics.id`-keyed, writes `pending`. Not yet exercised against live storage |

Nothing was regenerated, deleted or approved.

---

## J. Known limitations

1. **Artwork payload.** A stored topic illustration is a 1024×1024 PNG averaging **1.4 MB**, painted into a **56 px** thumbnail — roughly 330× more pixels than needed. Harmless today (0 approved, so none are served) and it becomes real the moment artwork is approved: a 30-topic list would pull ~40 MB on a South African mobile connection. Supabase image transforms would solve it in one line but are a **paid-plan feature and this project is on the free tier**, so it could not be fixed here. Two remedies: upgrade to Pro and use the render endpoint, or re-encode to WebP during upload (the upload path already decodes the image, so this is a contained change — ~10× smaller at the same visible quality).
2. **No authenticated browser testing** in this pass — see §A.
3. **Sentry DSN is declared in `src/lib/env.ts` and used nowhere.** There is no error tracking; the new boundary logs to the console only.
4. **No self-service account deletion**, and **no defined data-retention schedule** — both already disclosed honestly on the privacy page.
5. Whether the Sightengine vision-safety check is active on production cannot be seen from here. The privacy page already says so.
6. One orphaned storage object (1.3 MB); `media.subject_id`/`grade_id` NULL on all 151 rows. Both documented previously, neither harmful.

---

## K. Launch blockers

**One remaining.** (The subscription migration is applied — see §F.)

### 1. ~~Apply migration 0051~~ — DONE 2026-10-04

Applied and verified present. See §F, including a correction to the
original finding and one redundant trigger left behind for housekeeping.
**No longer a blocker.**

Two follow-ups, neither blocking:
- Drop the duplicate trigger (statements are in the migration file).
- Attempt a real forged insert from a browser session to confirm
  behaviourally; this session's permission layer declined the write test.

### 2. Confirm the video-review claim — P1, child safety and legal

The live privacy page states: *"Every video is watched in full and approved
by a human on our team before it can appear to any Learner."*

**71 videos are `verified = true` and learner-visible.** They carry a single
reviewer id and were created across **15 distinct minutes** spanning five
days — a rate inconsistent with watching each one in full at the time of
insert. This does **not** prove no review happened (`created_at` records the
insert, not the viewing), which is exactly why I have not changed either the
data or the wording: unverifying 71 videos would destroy your work, and
rewriting your own process claim on an inference would be worse.

**Action, one of:**
- Confirm you did watch all 71 in full — then nothing changes; or
- Soften the wording to describe what actually happens (e.g. "every video is reviewed and approved by a person before it appears"); or
- Set `verified = false` on the ones you have not watched, and work through them in the admin review queue.

A specific, falsifiable child-safety promise on a live legal page is the
one claim worth being certain about before taking money.

---

## L. Recommended final human actions

1. **Resolve the video-review claim** (§K.2) — the one true blocker.
3. **Do one real artwork upload** through the Illustration Studio against live storage — the only part of that pipeline this environment could not exercise.
4. **Regenerate B-01** with fewer, larger objects, matte, no ground plane, true transparency; check with `npm run check:art && npm run check:art:deep`, then look at it at 44 px before declaring it.
5. **Decide the entitlement model**: ship without a paywall deliberately, or add one — and if you add one, 0051 first.
6. **Have the legal pages reviewed by a person.** They are honest and unusually careful, but they have not been reviewed by a lawyer and this pass is not that review.
