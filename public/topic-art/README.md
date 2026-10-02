# Level C topic artwork

One illustration per topic, organised by subject:

```
public/topic-art/<subject-slug>/g<grade>-<topic-slug>.webp
```

**The grade is in the filename on purpose.** Topic slugs repeat across
grades — `visual-literacy-term-1` is three different Life Skills topics,
`1-1-whole-numbers` is three different Mathematics topics — so a
`<subject>/<topic-slug>.webp` path would quietly serve one picture to all
of them, and leave a reviewer unable to tell which grade they had
approved. Nine slugs collide this way, covering twenty topics.

This directory is empty of artwork. Nothing in the product is waiting on
it: a topic with no illustration renders without one.

## Specification

Square, **768 × 768 WebP**, generated at 1024 × 1024, under 260 KB.
Unlike the subject marks in `public/subject-art/`, these are **opaque** —
they render full-bleed inside a rounded card, so a transparent export
would show the card through the picture.

Prompts and paths: `docs/image-generation-manifest.json`.
How to generate them: `docs/IMAGE_GENERATION_WORKFLOW.md`.

## Validation

`npm run check:topic-art` checks every file here against the manifest:
it is a real WebP, square, roughly the right size, and some topic actually
claims that path. A file nothing claims is reported — almost always a typo
in the filename.

It cannot tell you whether a picture is any good or appropriate for
children. There is no automated approval state and none should be invented.

## Two sources of topic illustration

Be aware that the product already has a second, older path for topic
images: the `media` table, filled by the `generate-topic-illustration`
edge function and gated by human review in the admin Illustration Studio.
That path currently holds 151 images awaiting review, and it is the one
`TopicListPage` and the lesson visual step read from today.

**Nothing in the application reads this directory yet.** Wiring it up means
deciding which source wins when both exist, and that decision has not been
made. See the pipeline report.
