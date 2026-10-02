# B-01 Mathematics — the Level B benchmark

**Status: not generated.** No artwork exists for this or any other subject.
Every subject currently renders the gradient-and-glyph fallback, which is a
finished-looking state, so nothing in the product is waiting on this file.

This is the acceptance specification. It is the document a human checks a
candidate image against before deciding whether it becomes the benchmark the
other six Level B marks are judged by.

The copy-ready prompt is **not** reproduced here, because a second copy
drifts. It is the `prompt` field of asset `B-01` in
[`docs/image-generation-manifest.json`](./image-generation-manifest.json),
generated from `scripts/build-image-manifest.mjs`. Copy it verbatim.

---

## The file

| | |
|---|---|
| Path | `public/subject-art/mathematics.webp` |
| Generate at | 1024 × 1024 |
| Ship at | **512 × 512** |
| Format | **WebP** |
| Background | **Transparent — alpha channel required** |
| Maximum size | 120 KB |
| Aspect | Square, 1:1 |
| Composition | Inside the central 80%, 10% clear margin on all four sides |

The filename is not a convention, it is the mapping: `SubjectMark` looks a
subject up by slug, so the file must be named `<subject-slug>.webp` and
`mathematics` is the slug in the database. `npm run check:art` fails the
build on any other name.

### Why transparency is load-bearing

`SubjectMark` paints the subject's own colour gradient and composites the
artwork over it, so the picture and the existing colour system read as one
identity. An opaque export covers that gradient with a rectangle — and
still looks perfectly fine in isolation, which is what makes it dangerous.
Image tools show a transparency checkerboard in the preview and then
flatten onto white at export. `npm run check:art` reads the WebP header and
refuses a file with no alpha channel. Trust the check, not the preview.

**This is the opposite of Level C.** Topic illustrations must be opaque,
because they render full-bleed inside a card. Transparent Level C artwork is
rejected by the upload validator for the same reason opaque Level B artwork
is rejected by the build. They are different assets with opposite rules.

---

## Visual concept

Mathematics as **physical spatial relationships** — solids you could pick
up, a whole split into parts, and two quantities compared — arranged as
apparatus rather than notation.

The mathematics is in what the objects *do*, not in anything written on
them.

## Required objects

Six object groups, in one designed composition:

| Object | What it has to communicate |
|---|---|
| **Cube**, bright cyan-teal | The anchor of the group. Volume, solidity, three dimensions |
| **Cone**, resting beside it | A second, contrasting solid — curved against faceted |
| **Fraction-split disc** — a circle divided into three unequal coloured wedges sitting very slightly apart | Part and whole, **read from the geometry alone**, with no numerals and no written notation |
| **Two-pan balance**, tipped a fraction off level | Comparison and near-equivalence, **read from the tilt alone**, with no labels |
| **Square tiles**, a short flat stack | Area, unit, tessellation |
| **Round counters**, two or three | Discrete quantity |

They must overlap, share a material and a scale, and read as **one
considered arrangement** — not six separate clip-art objects placed on a
page. If the group does not read as a single silhouette at thumbnail size,
it has failed.

## Style

- Premium modern editorial educational illustration; contemporary product aesthetic
- Clean vector-leaning forms, gently rounded geometry
- Soft dimensional shading, subtle depth
- Matte paper / soft-touch plastic feel — **never glossy**
- Flat colour fills, crisp clean edges
- **No outlines**, no inked strokes, no grain, no halftone
- Medium saturation, low visual density
- Three-quarter elevated view, as if looking down at a table from slightly above and in front
- One soft light source from the **upper left**, short soft low-contrast shadows that model the forms
- **No ground plane. No surface. No drop shadow onto anything.** The objects float on transparency

### Palette

Deep navy, bright cyan-teal, warm amber-gold, soft lilac, off-white — with
**bright cyan-teal dominant**. These are the product's existing tokens, not
new colours.

---

## Rejection checklist

Reject rather than settle. The fallback already looks finished, so a weak
mark is strictly worse than no mark.

**Content**

- [ ] No text, letters or words anywhere
- [ ] No numbers, digits, operators or equations
- [ ] No labels or captions
- [ ] No logos, brand marks, watermarks or signatures
- [ ] No user interface, app screens or buttons
- [ ] No human figures, faces, hands or character mascots
- [ ] No national flags

**Objects that must not appear** — every one of these says "school
stationery" instead of "mathematics", and most of them carry digits a model
renders unreliably:

- [ ] No calculator, and no calculator keys
- [ ] No ruler, compass, protractor or set square
- [ ] No measurement markings or graduated scales of any kind
- [ ] No graph paper, graph axes or grids
- [ ] No notebook, notepad or paper
- [ ] No pencil or pen
- [ ] No mathematical formulae or written symbols
- [ ] No clock face
- [ ] No dice pips

**Style**

- [ ] Not preschool or babyish
- [ ] Not Disney or Pixar
- [ ] Not anime
- [ ] Not generic 3D clipart
- [ ] Not corporate stock illustration
- [ ] Not photorealistic, not glossy
- [ ] Not isometric technical drawing
- [ ] Not neon, not pastel-washed

**Technical**

- [ ] Background genuinely transparent, not white
- [ ] No ground plane, no cast shadow onto a surface
- [ ] Square, 512 × 512 at ship size
- [ ] Real WebP, not a renamed PNG
- [ ] Under 120 KB
- [ ] Named exactly `mathematics.webp`

**The squint test**

- [ ] Still legible shrunk to about 48 px. It renders at 40–64 px on subject
      cards; if it turns to mush, regenerate.

---

## A note on reference images

A glossy 3D-rendered maths composition was supplied alongside this
specification as a reference. It contains a calculator with visible digits,
the Pythagorean and quadratic formulae, a labelled right-angled triangle, a
π symbol, loose numerals, a compass, a set square with measurement
markings, graph paper, a notebook and a pencil, rendered with a high-gloss
plastic finish.

**Every one of those is on the prohibited list above**, and the gloss
contradicts the matte style lock. It is useful as a reference for *finish
quality and confidence* — it is a polished, deliberate piece of work — and
not as a reference for content, palette or material. A candidate that looks
like it would fail this specification.

This is not a judgement about the image. It is only that the two documents
describe different pictures, and the specification is the one the product is
built around.

---

## Shipping it

Generating the file is not approval. Nothing reads
`public/subject-art/` directly: `SubjectMark` reads the registry, and
**declaring the path in the registry is the approval step**.

1. Export to `public/subject-art/mathematics.webp`.
2. Open `src/lib/subjects/subjectArt.ts` and change the `mathematics` entry's
   `art` from `null` to
   `{ src: '/subject-art/mathematics.webp', focal: 'center' }`.
3. `npm run check:art` — fails on a missing file, a renamed PNG, the wrong
   size, no alpha channel, a filename that is not the subject slug, or a path
   outside `public/subject-art`.
4. `npm run typecheck && npm run lint && npm run build`.

A file sitting in the directory with no registry entry does not ship, and
`check:art` says so as a note rather than a failure — that is the normal
state of an image still being reviewed.

**No automated check approves artwork.** Every rule above that a script can
test is structural. Whether the picture is good, whether it is right for
nine-to-thirteen-year-olds, and whether it should be the benchmark are
human decisions.

---

## After this one

B-01 exists to be the benchmark. Judge B-02 to B-07 against the file that
actually shipped, not against this document — consistency with a real
reference is easier to see than consistency with a paragraph.

Generate B-04 (English Home Language) and B-05 (Afrikaans First Additional
Language) close together: they are the two subjects that share the `Aa`
glyph in the fallback, so they are the pair most at risk of looking like
each other.

B-08 (EMS), B-09 (Life Orientation) and B-10 (Technology) are deferred —
they have no topics yet.
