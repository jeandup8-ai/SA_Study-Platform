# StudyLegends artwork pipeline reconciliation

Reconciled 2026-10-02 against the live database. No artwork was generated,
no records were changed, and nothing was deleted.

---

## Canonical architecture

Two levels, two pipelines, and they do not overlap.

| | **Level B — subject marks** | **Level C — topic illustrations** |
|---|---|---|
| **Canonical store** | Filesystem: `public/subject-art/<slug>.webp` | **Media table + Supabase storage** |
| **Canonical identity** | Subject slug | **`topics.id`** |
| **Approval** | Declaring the path in `src/lib/subjects/subjectArt.ts` | **Admin Illustration Studio**, `approval_status` |
| **Rendered by** | `SubjectMark`, with gradient fallback | `TopicListPage`, lesson visual step |
| **Background** | Transparent (required) | Opaque |
| **Ship size** | 512 × 512 WebP | 1024 × 1024 generated; whatever the pipeline stores |
| **Count** | 10 planned, 7 priority | 224 topics, 142 candidates |

**`public/topic-art/` is not a publishing path.** It is documentation and a
planning layer: the per-topic paths in the manifest describe what a
file-based system *would* call each asset, which is useful for naming an
export before uploading it. Nothing in the application reads the directory,
and `npm run check:topic-art` now fails the build if an image appears there
— because a file there would never reach a learner and would never be
reviewed. See "Should it be removed" below.

The filesystem path is **not** the identity of a topic illustration. The
topic id is.

---

## Existing media inventory

Every figure queried, not assumed.

| | Count |
|---|---:|
| `media` rows, all types | 155 |
| — images | **151** |
| — non-image rows (video) | 4 |
| Images by provider | 151 OpenAI, 0 other |
| Images with a `topic_id` | **151 / 151** |
| Images with a `url` | **151 / 151** |
| Images with a stored `generation_prompt` | **151 / 151** |
| Images with a real object in storage | **151 / 151** |
| Generated | 2026-09-23, 06:29–07:40 UTC (a single 71-minute run) |

### Review state

| Status | Count |
|---|---:|
| `pending` | **151** |
| `approved` | **0** |
| `rejected` | **0** |

**Nothing has been reviewed yet.** No topic illustration is visible to any
learner today.

### Mapping to the live taxonomy

Mapped on `topic_id`, never on slug — topic slugs collide across grades.

| | Count |
|---|---:|
| Map to a live, non-demo topic | **151** |
| `topic_id` not found | 0 |
| Map to demo content | 0 |
| **Orphaned or unmapped** | **0** |
| Distinct topics covered | **151** |
| **Duplicates** (two images for one topic) | **0** |

### Metadata and provenance

- `generation_prompt` is stored on every row — full provenance of what
  produced each image.
- `source` records the model (`ai_generated:gpt-image-1`).
- `approval_status` is the review state; the `media_read` RLS policy is what
  keeps a pending image away from learners.
- **`subject_id` and `grade_id` are NULL on all 151 rows.** Those columns
  exist on `media` but were never populated by the generator. Not a defect
  for mapping — `topic_id` resolves subject and grade through `topics` —
  but worth knowing before anyone writes a query that trusts them.
- **Assets are replaceable.** There are no inbound foreign keys to
  `media.id`, so regenerating a topic's artwork inserts a new row and
  breaks no references.

### One storage orphan

`topic-illustrations/a27e27b8-…/1790145394295.png` (1.3 MB) has no media
row. It is the "Active and passive voice" image whose row was deleted on
23 September because it had been generated before the prompt builder knew
that topic, and so carried generic subject direction rather than a
topic-specific scene. The file was left behind.

Harmless — nothing references it, and it is not public-facing in any
meaningful sense — but it is 1.3 MB of dead storage. **Cleanup is a future
task; nothing was deleted here.**

---

## Reconciliation: existing artwork against the 142 candidates

| Classification | Has artwork | No artwork | Total |
|---|---:|---:|---:|
| `VISUAL_REQUIRED` | 44 | 24 | 68 |
| `VISUAL_USEFUL` | 42 | 32 | 74 |
| `VISUAL_NOT_NEEDED` | 38 | 13 | 51 |
| `SOURCE_INCOMPLETE` | 27 | 4 | 31 |
| **Total** | **151** | **73** | **224** |

### What that means

**Of the 142 topics that want artwork, 86 already have it** — generated,
stored, mapped to the right topic, and sitting unreviewed. **56 genuinely
need new generation**, not 142.

**Of the 151 existing images, 65 are for topics the classification says
need no artwork** — 38 `VISUAL_NOT_NEEDED` and 27 `SOURCE_INCOMPLETE`.
That is 43% of everything generated. It happened because the September run
worked alphabetically through every topic, before any classification
existed.

Those 65 are already generated and already paid for. The cost of keeping
them is review time, not money. They are **not** deleted and **not**
regenerated; they are marked `RETAIN_FOR_REVIEW_RECLASSIFIED` so the
decision stays yours. A reasonable approach is to leave them pending
indefinitely and review the 86 first.

### Actions, per topic

Recorded on every Level C asset in the manifest. Derived from metadata
alone — whether artwork exists, and how the topic is classified. **No
action here is a judgement about whether an existing picture is any good.**

| Action | Count | Meaning |
|---|---:|---|
| `HUMAN_VISUAL_REVIEW_REQUIRED` | **86** | Artwork exists for a wanted topic. Needs a person to look at it. |
| `RETAIN_FOR_REVIEW_RECLASSIFIED` | **65** | Artwork exists for a topic now classified as not needing it. Kept, not deleted. |
| `GENERATE` | **56** | Wanted, no artwork. This is the real remaining Level C work. |
| `NO_ARTWORK_PLANNED` | **17** | Not wanted, none exists. Nothing to do. |

86 + 65 = 151 existing. 56 + 17 = 73 missing. 224 total.

### Would anything be generated twice?

**No.** The 56 `GENERATE` topics have no existing media row, and the 142
candidate prompts are keyed on `topicId`. Generating all 56 and uploading
them would leave every topic with at most one image. The 86 that already
have artwork must be **reviewed**, not regenerated — regenerating one
merely because a prompt now exists would discard work already paid for and
produce a second pending row for the same topic.

### Is the existing artwork conceptually compatible with the new prompts?

**Deterministically: yes.** Each of the 151 images stores the prompt that
produced it, and those prompts came from the same `prompt.ts` scene mapping
the new manifest reuses. The topic-specific scene in an existing image's
prompt is therefore the same scene the new prompt specifies. The visual
style lock differs — the new prompts are far more prescriptive about
rendering, lighting and palette — so the old images will not match the new
house style as closely.

**Whether any individual image is actually good is not determinable from
metadata**, and no automated check or language model should pretend
otherwise. Every one of the 151 is marked for human visual review.

---

## The OpenAI credit dependency is no longer a blocker

Artwork generation moves to ChatGPT. The 73 missing images are no longer
waiting on account credit.

**Nothing was deleted, reset or migrated.** The `generate-topic-illustration`
edge function, the batch function, the media records, the stored prompts and
the Illustration Studio all remain exactly as they are. The in-app
"Generate" button still works and will still work the moment credit is
added — it is simply no longer the planned route.

---

## The new workflow

```
  topic (canonical: topics.id)
        │
        ▼
  manifest prompt  ──copy──►  ChatGPT image generation
                                      │
                                      ▼
                              you inspect it
                                      │
                                      ▼
                        upload via Illustration Studio
                                      │
                                      ▼
                      media row, approval_status='pending'
                                      │
                                      ▼
                           Illustration Studio review
                                      │
                         ┌────────────┴────────────┐
                         ▼                         ▼
                     approved                  rejected
                         │
                         ▼
                 visible to learners
```

**The review gate is never bypassed.** Approval remains a human action in
the Studio, and `approval_status='approved'` remains the only thing that
makes an image visible to a learner.

> **One gap to be aware of.** The Illustration Studio can currently
> *generate* an image and *review* one, but it has no **upload** control —
> the existing pipeline only ever created media rows from its own generator.
> Steps 5 and 6 above therefore need an upload path added to the Studio
> before ChatGPT-generated topic artwork can enter the pipeline. That is
> not built, and this task did not build it. See "Remaining work".

---

## Generation priority

| Priority | What | Count |
|---|---|---:|
| 1 | Level B subject marks — **start with B-01 Mathematics** | 7 |
| 2 | Review existing Level C artwork for wanted topics | 86 |
| 3 | Generate missing `VISUAL_REQUIRED` | 24 |
| 4 | Generate missing `VISUAL_USEFUL` | 32 |
| 5 | Revisit after curriculum source validation | 31 |
| — | `VISUAL_NOT_NEEDED` — do not generate | 51 |
| — | Level B deferred (EMS, Life Orientation, Technology) | 3 |

Priority 2 costs review time, not generation. It is the cheapest large win
available: 86 images already exist and currently show to nobody.

---

## Should `public/topic-art/` be removed?

Not yet, and not urgently.

**Keep it for now** because the manifest's per-topic paths are a useful
naming convention for exports on their way to the Studio, the README
documents the decision where someone would actually look for it, and
`check:topic-art` actively prevents the second pipeline from being built
by accident.

**Remove it** once the Studio has an upload control and a documented naming
convention of its own, at which point the directory and its check become
redundant. Until then the guard earns its place: it is the only thing
standing between a well-meant export and a shadow pipeline.
