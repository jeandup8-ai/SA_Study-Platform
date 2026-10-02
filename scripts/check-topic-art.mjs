#!/usr/bin/env node
// Guards against a second Level C pipeline appearing.
//
// Topic artwork has one publishing path, and it is not the filesystem:
//
//   generate -> media row (approval_status='pending')
//            -> admin Illustration Studio
//            -> approved
//            -> rendered to learners
//
// The canonical identity of a topic illustration is `topics.id`, and the
// asset lives in Supabase storage referenced by a `media` row. That
// pipeline already holds 151 images and already has a human review gate,
// which is the thing that must not be bypassed.
//
// `public/topic-art/` exists as documentation and as the planning layer in
// docs/image-generation-manifest.json -- the per-topic paths there describe
// what a file-based system *would* be called, and are useful for naming an
// export before it is uploaded. Nothing in the application reads the
// directory. An image file appearing in it therefore means one of two
// things, and both are worth stopping for:
//
//   - someone exported artwork and dropped it here instead of putting it
//     through the Studio, so it will never reach a learner and will never
//     be reviewed; or
//   - someone is starting to build the second pipeline that this project
//     deliberately decided against.
//
// Hence: this directory must contain no images. The check explains rather
// than merely failing, because the fix is a process, not a file edit.
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = 'public/topic-art'
const ALLOWED = new Set(['README.md'])

function walk(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    return e.isDirectory() ? walk(p) : [p]
  })
}

const stray = walk(ROOT).filter((p) => !ALLOWED.has(p.split('/').pop()))

if (stray.length > 0) {
  console.error(`topic art check failed: ${stray.length} file(s) in ${ROOT}, which is not a publishing path.`)
  for (const f of stray) {
    console.error(`  ${f}  (${Math.round(statSync(f).size / 1024)}KB)`)
  }
  console.error('')
  console.error('  Topic illustrations are published through the media table and the admin')
  console.error('  Illustration Studio, not from the filesystem. A file here will never reach')
  console.error('  a learner and will never be reviewed.')
  console.error('')
  console.error('  Upload the image through the Illustration Studio instead, so it lands as a')
  console.error('  media row with approval_status=\'pending\' and goes through the review gate.')
  console.error('  See docs/ARTWORK_PIPELINE_RECONCILIATION.md.')
  process.exit(1)
}

console.log(
  'topic art ok: no files in public/topic-art (correct — Level C publishes through the media table)',
)
