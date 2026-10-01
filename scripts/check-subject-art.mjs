#!/usr/bin/env node
// Validates every Level B subject illustration the registry declares.
//
// The registry's whole design is that a subject with no artwork renders a
// gradient and glyph and looks finished. That only holds if the other
// branch is true as well: a subject that *does* declare artwork must have
// a real, usable file behind it. A path typed wrongly, a file that never
// got committed, or a PNG renamed to .webp all produce the one state the
// architecture is supposed to make impossible -- a broken image on every
// card for that subject.
//
// So this fails the build when a declared file is missing or unusable. It
// says nothing at all about subjects declaring `null`; those are the
// normal, intended, shipping state.
//
// What it cannot do is judge the picture. "File is a valid 512-square
// transparent WebP" is not "a human looked at this and approved it for
// children". The approval state lives in the registry -- a path is only
// written there after someone has reviewed the image -- and nothing here
// may be read as approval.
import { readFileSync, existsSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const SOURCE = 'src/lib/subjects/subjectArt.ts'
const PUBLIC_DIR = 'public'

// Generous bounds. The point is to catch a wrong file, not to police art
// direction: a 2000px hero dropped in by mistake, or a 40px favicon.
const EXPECTED_EDGE = 512
const EDGE_TOLERANCE = 0.5 // accept 256..1024
const MAX_BYTES = 120 * 1024

/** Minimal WebP header reader: dimensions and whether an alpha channel exists. */
function readWebp(buf) {
  if (buf.length < 16) return { ok: false, why: 'file is too short to be an image' }
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') {
    const looksPng = buf.length > 8 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
    const looksJpeg = buf[0] === 0xff && buf[1] === 0xd8
    const actual = looksPng ? 'a PNG' : looksJpeg ? 'a JPEG' : 'not an image this check recognises'
    return { ok: false, why: `not a WebP file (it is ${actual}), despite the .webp name` }
  }

  const fourcc = buf.toString('ascii', 12, 16)

  if (fourcc === 'VP8X') {
    // Extended format. Flags byte bit 4 (0x10) is ALPHA; canvas size is
    // stored as three bytes each, minus one.
    const flags = buf[20]
    const width = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16))
    const height = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16))
    return { ok: true, width, height, alpha: Boolean(flags & 0x10), variant: 'extended' }
  }

  if (fourcc === 'VP8L') {
    // Lossless. The 14-bit width/height follow the 0x2f signature byte, and
    // the alpha_is_used hint is bit 3 of the fifth byte after it.
    const b = buf.subarray(21, 26)
    const bits = b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24)
    const width = (bits & 0x3fff) + 1
    const height = ((bits >> 14) & 0x3fff) + 1
    return { ok: true, width, height, alpha: Boolean((bits >> 28) & 1), variant: 'lossless' }
  }

  if (fourcc === 'VP8 ') {
    // Simple lossy. This variant cannot carry alpha at all.
    const width = buf.readUInt16LE(26) & 0x3fff
    const height = buf.readUInt16LE(28) & 0x3fff
    return { ok: true, width, height, alpha: false, variant: 'simple lossy' }
  }

  return { ok: false, why: `unrecognised WebP chunk "${fourcc}"` }
}

const outDir = mkdtempSync(join(tmpdir(), 'subject-art-'))
let SUBJECT_SKINS
try {
  execFileSync(
    'npx',
    ['tsc', '--ignoreConfig', '--target', 'es2022', '--module', 'esnext', '--outDir', outDir, SOURCE],
    { stdio: 'pipe' },
  )
  ;({ SUBJECT_SKINS } = await import(pathToFileURL(join(outDir, 'subjectArt.js')).href))
} finally {
  rmSync(outDir, { recursive: true, force: true })
}

const entries = Object.entries(SUBJECT_SKINS)
const declared = entries.filter(([, skin]) => skin.art)
const problems = []

for (const [slug, skin] of declared) {
  const src = skin.art.src
  if (!src.startsWith('/')) {
    problems.push(`${slug}: src "${src}" must be an absolute path served from /public`)
    continue
  }
  const file = join(PUBLIC_DIR, src.slice(1))

  if (!existsSync(file)) {
    problems.push(`${slug}: declares "${src}" but ${file} does not exist`)
    continue
  }

  const bytes = statSync(file).size
  if (bytes === 0) {
    problems.push(`${slug}: ${file} is empty`)
    continue
  }
  if (bytes > MAX_BYTES) {
    problems.push(
      `${slug}: ${file} is ${Math.round(bytes / 1024)}KB, over the ${MAX_BYTES / 1024}KB budget for a card-sized mark`,
    )
  }

  const info = readWebp(readFileSync(file))
  if (!info.ok) {
    problems.push(`${slug}: ${file} is ${info.why}`)
    continue
  }

  const lo = EXPECTED_EDGE * EDGE_TOLERANCE
  const hi = EXPECTED_EDGE / EDGE_TOLERANCE
  if (info.width !== info.height) {
    problems.push(`${slug}: ${file} is ${info.width}x${info.height}; the mark renders in a square`)
  }
  if (info.width < lo || info.width > hi) {
    problems.push(
      `${slug}: ${file} is ${info.width}px wide; expected around ${EXPECTED_EDGE}px (${lo}-${hi})`,
    )
  }
  if (!info.alpha) {
    problems.push(
      `${slug}: ${file} has no alpha channel (${info.variant} WebP), so it will cover the subject's ` +
        `gradient with an opaque rectangle. Re-export with transparency.`,
    )
  }
}

if (problems.length > 0) {
  console.error(`subject art check failed (${problems.length}):`)
  for (const p of problems) console.error(`  ${p}`)
  process.exit(1)
}

const fallback = entries.length - declared.length
console.log(
  `subject art ok: ${declared.length} with approved artwork, ${fallback} on the gradient fallback ` +
    `(${entries.length} subjects)`,
)
