#!/usr/bin/env node
// Validates Level C topic artwork against the manifest.
//
// This is the counterpart to check-subject-art.mjs and differs from it in
// two ways that matter.
//
// First, topic artwork does NOT need an alpha channel. A subject mark is
// composited over the subject's gradient, so transparency is load-bearing
// there; a topic illustration renders full-bleed inside a rounded card, so
// an opaque background is correct.
//
// Second, nothing declares topic artwork in code. Subject artwork is wired
// up by a registry entry, so a declared-but-missing file breaks the UI and
// has to fail the build. Topic files are discovered by path, so the risks
// are the other way round: a file in the tree that no topic will ever ask
// for (a typo, a renamed topic, a stale export), or two files racing for
// one path. Those are what this reports.
//
// It never claims a file is approved. A valid 768-square WebP is not
// "someone looked at this and judged it fit for children".
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const MANIFEST = 'docs/image-generation-manifest.json'
const ROOT = 'public/topic-art'

const EXPECTED_EDGE = 768
const EDGE_TOLERANCE = 0.5 // accept 384..1536
const MAX_BYTES = 260 * 1024

/** Minimal WebP header reader. Shared shape with check-subject-art.mjs. */
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
    return {
      ok: true,
      width: 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16)),
      height: 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16)),
    }
  }
  if (fourcc === 'VP8L') {
    const b = buf.subarray(21, 26)
    const bits = b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24)
    return { ok: true, width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
  }
  if (fourcc === 'VP8 ') {
    return { ok: true, width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff }
  }
  return { ok: false, why: `unrecognised WebP chunk "${fourcc}"` }
}

if (!existsSync(MANIFEST)) {
  console.error(`topic art check failed: ${MANIFEST} is missing. Run scripts/build-image-manifest.mjs.`)
  process.exit(1)
}
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
const problems = []
const notes = []

// --- manifest integrity, independent of whether any file exists ------------
const declared = new Map()
for (const a of manifest.assets) {
  if (!a.outputFilename) continue
  const path = `${a.outputDirectory}/${a.outputFilename}`
  if (declared.has(path)) {
    problems.push(`duplicate output path "${path}" claimed by both ${declared.get(path)} and ${a.id}`)
  }
  declared.set(path, a.id)
}

const topicAssets = manifest.assets.filter((a) => a.level === 'C' && a.outputFilename)
const expected = new Set(topicAssets.map((a) => `${a.outputDirectory}/${a.outputFilename}`))

// --- files on disk ---------------------------------------------------------
function walk(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    return e.isDirectory() ? walk(p) : [p]
  })
}

const onDisk = walk(ROOT).filter((p) => !p.endsWith('README.md'))
let valid = 0

for (const file of onDisk) {
  if (!file.endsWith('.webp')) {
    problems.push(`${file}: topic artwork must be .webp`)
    continue
  }
  if (!expected.has(file)) {
    problems.push(
      `${file}: no manifest asset claims this path. Either the filename is wrong, or the topic it ` +
        `belongs to is classified as needing no artwork.`,
    )
    continue
  }

  const bytes = statSync(file).size
  if (bytes === 0) {
    problems.push(`${file} is empty`)
    continue
  }
  if (bytes > MAX_BYTES) {
    notes.push(`${file} is ${Math.round(bytes / 1024)}KB, over the ${MAX_BYTES / 1024}KB guide — review rather than reject`)
  }

  const info = readWebp(readFileSync(file))
  if (!info.ok) {
    problems.push(`${file} is ${info.why}`)
    continue
  }
  if (info.width !== info.height) {
    problems.push(`${file} is ${info.width}x${info.height}; topic artwork renders in a square container`)
    continue
  }
  const lo = EXPECTED_EDGE * EDGE_TOLERANCE
  const hi = EXPECTED_EDGE / EDGE_TOLERANCE
  if (info.width < lo || info.width > hi) {
    problems.push(`${file} is ${info.width}px; expected around ${EXPECTED_EDGE}px (${lo}-${hi})`)
    continue
  }
  valid += 1
}

if (problems.length > 0) {
  console.error(`topic art check failed (${problems.length}):`)
  for (const p of problems) console.error(`  ${p}`)
  process.exit(1)
}

for (const n of notes) console.warn(`  note: ${n}`)
console.log(
  `topic art ok: ${valid} file${valid === 1 ? '' : 's'} present and valid, ` +
    `${expected.size} path${expected.size === 1 ? '' : 's'} planned in the manifest`,
)
