# This is not where topic artwork lives

Topic illustrations are published through the **media table and the admin
Illustration Studio**, not from the filesystem. The canonical identity of a
topic illustration is `topics.id`, and the asset is a Supabase storage
object referenced by a `media` row with an `approval_status`.

That pipeline already holds **151 images awaiting review**.

See [`docs/ARTWORK_PIPELINE_RECONCILIATION.md`](../../docs/ARTWORK_PIPELINE_RECONCILIATION.md).

## So why does this directory exist

As a naming convention. `docs/image-generation-manifest.json` gives every
Level C asset a path of the form:

```
public/topic-art/<subject-slug>/g<grade>-<topic-slug>.webp
```

which is a useful, collision-free name for an export on its way to the
Studio. The grade is in the name because topic slugs repeat across grades —
`visual-literacy-term-1` is three different Life Skills topics — so a
subject-plus-slug name would serve one picture to several topics and leave
a reviewer unable to tell which grade they had approved.

**Nothing in the application reads this directory.**

## The build will fail if you put an image here

`npm run check:topic-art` fails on any file here other than this README.
That is deliberate. A file in this directory means either an export landed
here instead of going through the Studio — in which case it will never
reach a learner and will never be reviewed — or a second publishing
pipeline is being built by accident. Both are worth stopping for.

Upload the image through the Illustration Studio instead: **Admin →
Illustrations**, find the topic, press **Upload**. The file is validated
(square, opaque, 1024px, really an image), stored in the
`topic-illustrations` bucket under the topic's UUID, and recorded as a
`media` row with `approval_status='pending'` for review.

## Level B is different

Subject marks **are** file-based: `public/subject-art/<slug>.webp`,
declared in `src/lib/subjects/subjectArt.ts`. They are transparent, they
have no review table, and declaring the path is the approval. Do not
confuse the two.
