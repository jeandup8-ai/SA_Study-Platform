# Generating StudyLegends artwork in ChatGPT

Everything you need to turn a prompt into a shipped image. No artwork
exists yet; nothing in the product is waiting on a file, because every
subject renders a gradient-and-glyph tile and every topic renders without
an illustration. Add images one at a time, in any order.

Two kinds of artwork, and they are **not** interchangeable:

| | Level B — subject marks | Level C — topic illustrations |
|---|---|---|
| What it is | One image per subject | One image per topic |
| Where it renders | 40–64 px square tile on subject cards and the topic-list header | Full-bleed square inside a card, and large in a lesson's visual step |
| Published via | Filesystem + registry | **Media table + Illustration Studio upload** |
| Canonical identity | Subject slug | **`topics.id`** |
| Background | **Transparent — required** | **Opaque — it fills the card** |
| Generate at | 1024 × 1024 | 1024 × 1024 |
| Ship at | 512 × 512 WebP, ≤120 KB | 1024 × 1024; WebP preferred, PNG accepted, ≤8 MB |
| Human figures | Never | Allowed, but no realistic faces |
| How many | 10 planned, 7 priority | 56 still need generating; 86 already exist and need review |

---

## The loop

1. **Pick an asset** from `docs/image-generation-manifest.json`, or from the
   copy-ready page for the subject marks. Start with **B-01 Mathematics** —
   it is the benchmark the rest of Level B is judged against.
2. **Copy its `prompt` field verbatim** into ChatGPT. Do not paraphrase it
   or trim the style block: the style block is what keeps separately
   generated images looking like one set.
3. **Generate.** If the first result is close but wrong in one way, say
   what is wrong rather than re-sending the prompt — ChatGPT keeps the
   style and fixes the one thing.
4. **Check it against the list below.** Reject rather than settle; a weak
   image is worse than the fallback, which already looks finished.
5. **Export** at the size in the table above, as WebP. For Level B the
   alpha channel must survive — see the trap below.
6. **Rename** to exactly the `outputFilename` in the manifest.
7. **Level C stops here and goes a different way.** Topic illustrations are
   **not** filesystem assets. In the admin Illustration Studio, find the
   topic, press **Upload**, and pick the file. It is checked (square,
   opaque, right size, really an image), stored, and recorded as a `media`
   row with `approval_status='pending'` — then reviewed in the same dialog
   as a generated image. Dropping it into `public/topic-art/` instead will
   fail the build, because a file there would never reach a learner and
   would never be reviewed.

   Paste the prompt you used into the **Prompt used** box. A reviewer
   rejecting a weak picture can then tell whether the prompt or the model
   was at fault, which is the same thing `generation_prompt` does for
   generated images.
8. **Level B only — drop it** into `public/subject-art/`, then **declare it**.
   Open `src/lib/subjects/subjectArt.ts` and
   change that subject's `art` from `null` to
   `{ src: '/subject-art/<slug>.webp', focal: 'center' }`.
   **This step is the approval.** A file on disk that nothing declares does
   not ship, and `npm run check:art` will tell you it is sitting there
   unused.
9. **Validate**: `npm run check:art && npm run check:topic-art`
10. **Gate**: `npm run typecheck && npm run lint && npm run build`
11. **Commit.**

---

## Rejection checklist

Run every image past all of these. Most failures are the first one.

- [ ] No text, letters or words anywhere — including on book pages, signs, screens and packaging
- [ ] No numbers, digits or equations
- [ ] No labels or captions
- [ ] No logos, brand marks or trademarks
- [ ] No watermark or signature
- [ ] No fake user interface, app screens or buttons
- [ ] Correct subject or topic — it depicts what the prompt asked for
- [ ] Correct visual concept, not a generic classroom scene
- [ ] **Level B only:** background is genuinely transparent, not white
- [ ] **Level B only:** no human figures, faces or hands
- [ ] No realistic photographic faces anywhere
- [ ] No copyrighted or recognisable characters
- [ ] No incorrect educational symbolism (a wrong diagram is worse than none)
- [ ] Square, and the right pixel size
- [ ] Exact filename from the manifest
- [ ] **Still readable shrunk to about 48 px** — squint at it; if it turns to mush, regenerate
- [ ] Looks like it belongs beside the others in the set

### Two traps worth naming

**The white background that looks transparent.** Image tools happily show
you a checkerboard in the preview and then flatten onto white at export.
For Level B this is fatal and invisible: the artwork covers the subject's
colour gradient with an opaque rectangle, and the card still looks
plausible on its own. `npm run check:art` catches it — it reads the WebP
header and refuses a file with no alpha channel. Trust the check, not the
preview.

**Text that creeps back in.** Image models render letters unreliably, and
a garbled word in a maths illustration is worse than no illustration,
because a child may read it as content. Every prompt forbids text three
separate times and they still slip through. Look at the corners.

---

## Commands

```
npm run check:art         # Level B: files the registry declares
npm run check:topic-art   # Level C: guards against a filesystem pipeline
npm run check:upload      # Level C: the upload rules, against real fixtures
npm run build             # runs all three, plus i18n and prompt checks
```

`check:art` fails the build on a declared file that is missing, is a
renamed PNG, is the wrong size, has no alpha, is named after something
other than its subject slug, or sits outside `public/subject-art`.
`check:topic-art` fails on *any* image in `public/topic-art`, because that
directory is not a publishing path. `check:upload` runs the upload
validator over fourteen real images in `scripts/fixtures/artwork`, each
wrong in one specific way, and asserts which rule catches each.

Neither says anything about whether the picture is good. **No automated
check approves artwork.** A person does, by declaring it.

---

## Regenerating the manifest

```
node scripts/build-image-manifest.mjs
```

It reads the real curriculum from `scripts/fixtures/topics-live.tsv` and the
topic-to-scene mapping from the live prompt builder, so the manifest cannot
drift from the product. Re-run it whenever curriculum changes. Do not
hand-edit `docs/image-generation-manifest.json`.

If topics have been added or renamed in the database, refresh the TSV
first — its id column was checksummed against the database when it was
written, and that check is worth repeating.

---

## Which topics get artwork, and why 142 and not 224

Every topic was classified against the question *does a picture do
educational work here*, not *could we draw something*:

| Classification | Count | Meaning |
|---|---:|---|
| `VISUAL_REQUIRED` | 68 | A physical system, process, structure, place or cycle. The picture makes it concrete. |
| `VISUAL_USEFUL` | 74 | Concrete enough that the picture aids recognition and recall. |
| `VISUAL_NOT_NEEDED` | 51 | Abstract metalanguage — parts of speech, tense, voice, procedural arithmetic. The concept lives in the words, and a picture would be decoration. |
| `SOURCE_INCOMPLETE` | 31 | The curriculum source is flagged `REVIEW_REQUIRED` or `CONFLICTING`. A "curriculum-specific" illustration would be specific to something nobody has confirmed. |

Prompts exist for the first two groups only. The rules are in
`scripts/build-image-manifest.mjs` and are plain keyword lists, so you can
read them and disagree with them — change the lists and regenerate.

Nothing stops a `VISUAL_NOT_NEEDED` topic getting artwork later; it just
has no prompt and no planned path today, so `check:topic-art` would flag a
file dropped in for one.
