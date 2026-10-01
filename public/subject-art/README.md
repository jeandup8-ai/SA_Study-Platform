# Level B subject artwork

Approved subject illustrations live here, one WebP per subject, named for
the subject's slug — `mathematics.webp`, `natural-sciences.webp`, and so
on. The prompts that produce them are in
[`docs/IMAGE_GENERATION_MANIFEST.md`](../../docs/IMAGE_GENERATION_MANIFEST.md).

**This directory is empty of artwork on purpose.** Every subject currently
renders the gradient-and-glyph tile from
`src/lib/subjects/subjectArt.ts`, which is a finished design, not a
placeholder. Artwork is added one subject at a time, and a subject without
it looks complete.

## Adding an approved image

1. Review the generated image. Two things matter more than taste: it must
   contain **no text, letters or numbers anywhere**, and it must still read
   at about 48px, which is the size it renders at on a subject card.
2. Export WebP, **512 × 512**, **transparent background**, under 120KB.
   The transparency is load-bearing — the subject's gradient shows through
   behind the artwork, and an opaque export covers it with a rectangle.
3. Save it here as `<slug>.webp`.
4. In `src/lib/subjects/subjectArt.ts`, change that subject's `art` from
   `null` to `{ src: '/subject-art/<slug>.webp', focal: 'center' }`.

Nothing else changes. `SubjectMark` picks it up on every surface at once.

## What the build checks, and what it does not

`npm run check:art` (also part of `prebuild`) validates every file the
registry declares: it exists, it is genuinely a WebP rather than a renamed
PNG, it is square and roughly 512px, it has a real alpha channel, and it is
within budget. A declared path with no usable file behind it **fails the
build** rather than shipping a broken image on every card for that subject.

It says nothing about subjects set to `null`; that is the normal state.

It also cannot tell you whether a picture is any good, or whether it is
appropriate for children. **Writing a path into the registry is the
approval**, and only a person does that. There is no automated approval
state and none should be invented.

## Deferred

Economic and Management Sciences, Life Orientation and Technology carry no
topics yet. They stay on the fallback until their artwork is explicitly
commissioned and approved.
