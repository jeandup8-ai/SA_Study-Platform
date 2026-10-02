#!/usr/bin/env node
// Exercises the Level C upload rules against real image files.
//
// The upload path in the Illustration Studio is the one place where bytes
// a person chose on their own machine enter the artwork pipeline. Its
// rules therefore have to hold for files nobody anticipated: a PNG renamed
// to .webp, an export truncated by a dropped connection, a phone photo, a
// 4096px canvas, a transparent background that looked right in the
// preview. Those are not hypothetical -- the transparent-background trap
// has already been written up twice in this repository because image tools
// show a checkerboard and then flatten on export.
//
// So the fixtures in scripts/fixtures/artwork are genuine images, each
// wrong in exactly one way, and this asserts which rule fires for each.
// A validator that has never seen a malformed file is a validator nobody
// has tested.
//
// TWO HONEST LIMITS.
//
// Node has no canvas, so `measureTransparency` -- the function that decodes
// an image and counts see-through pixels -- cannot run here. What runs here
// is the rule that consumes its output, fed the fixture's true transparent
// fraction as measured when the fixtures were generated
// (scripts/fixtures/artwork/measured.json). The measurement itself is
// browser code and is verified in the browser.
//
// And nothing here says whether a picture is any good. Every rule is
// structural. Approval stays a human pressing Approve in the Studio.
import { readFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const SOURCE = 'src/lib/admin/artworkValidation.ts'
const FIXTURES = 'scripts/fixtures/artwork'
const MEASURED = join(FIXTURES, 'measured.json')

const outDir = mkdtempSync(join(tmpdir(), 'artwork-validation-'))
let mod
try {
  execFileSync(
    'npx',
    ['tsc', '--ignoreConfig', '--target', 'es2022', '--module', 'esnext', '--outDir', outDir, SOURCE],
    { stdio: 'pipe' },
  )
  mod = await import(pathToFileURL(join(outDir, 'artworkValidation.js')).href)
} finally {
  rmSync(outDir, { recursive: true, force: true })
}

const {
  validateLevelCUpload,
  readImageHeader,
  sniffImageFormat,
  topicArtworkStoragePath,
  isUuid,
  externalUploadSource,
  mimeTypeFor,
  extensionFor,
  LEVEL_C_MAX_BYTES,
} = mod

const measured = existsSync(MEASURED) ? JSON.parse(readFileSync(MEASURED, 'utf8')) : {}
const failures = []
let checks = 0

function check(label, condition, detail = '') {
  checks++
  if (!condition) failures.push(detail ? `${label} — ${detail}` : label)
}

/** Runs the validator over a fixture, supplying its real transparency. */
function run(name, overrides = {}) {
  const bytes = new Uint8Array(readFileSync(join(FIXTURES, name)))
  const m = measured[name] ?? {}
  return validateLevelCUpload({
    fileName: name,
    declaredMimeType: overrides.declaredMimeType ?? 'image/webp',
    bytes,
    decoded: 'decoded' in overrides ? overrides.decoded : !m.undecodable,
    transparentFraction:
      'transparentFraction' in overrides
        ? overrides.transparentFraction
        : m.transparentFraction,
  })
}

const rules = (r) => [...r.errors, ...r.warnings].map((f) => f.rule)
const errorRules = (r) => r.errors.map((f) => f.rule)

// ---------------------------------------------------------------------------
// Files that must be accepted
// ---------------------------------------------------------------------------

{
  const r = run('valid-1024.webp')
  check('valid-1024.webp accepted', r.ok, `errors: ${errorRules(r).join(', ')}`)
  check('valid-1024.webp has no warnings', r.warnings.length === 0, rules(r).join(', '))
  check('valid-1024.webp read as 1024 square webp',
    r.header?.format === 'webp' && r.header.width === 1024 && r.header.height === 1024,
    JSON.stringify(r.header))
}

{
  // PNG is what the existing generator writes, so it must pass -- with a
  // nudge toward WebP, not a rejection.
  const r = run('valid-1024.png', { declaredMimeType: 'image/png' })
  check('valid-1024.png accepted', r.ok, errorRules(r).join(', '))
  check('valid-1024.png warns format-not-preferred',
    rules(r).includes('format-not-preferred'), rules(r).join(', '))
}

{
  const r = run('valid-1024.jpg', { declaredMimeType: 'image/jpeg' })
  check('valid-1024.jpg accepted', r.ok, errorRules(r).join(', '))
  check('jpeg dimensions read from SOF',
    r.header?.width === 1024 && r.header.height === 1024, JSON.stringify(r.header))
}

{
  // The common correct export: an alpha channel that is entirely opaque.
  // Rejecting this on the header flag alone would reject most real files.
  const r = run('valid-1024-rgba-opaque.png', { declaredMimeType: 'image/png' })
  check('RGBA-but-opaque PNG accepted', r.ok, errorRules(r).join(', '))
  check('RGBA PNG header reports a possible alpha channel',
    r.header?.mayHaveAlpha === true, JSON.stringify(r.header))
  check('RGBA-but-opaque PNG does not trip not-opaque',
    !rules(r).includes('not-opaque'), rules(r).join(', '))
}

// ---------------------------------------------------------------------------
// Files that must be rejected, each for its own reason
// ---------------------------------------------------------------------------

const rejections = [
  ['empty.webp', 'empty'],
  ['not-an-image.webp', 'unsupported-format'],
  ['truncated.webp', 'corrupt-header'],
  ['nonsquare-1024x768.webp', 'not-square'],
  ['too-small-256.webp', 'too-small'],
  ['too-large-4096.webp', 'too-large'],
  ['transparent-1024.webp', 'not-opaque'],
  ['transparent-1024.png', 'not-opaque'],
]

for (const [name, expected] of rejections) {
  const r = run(name, name.endsWith('.png') ? { declaredMimeType: 'image/png' } : {})
  check(`${name} rejected`, !r.ok, 'it was accepted')
  check(`${name} rejected by "${expected}"`, errorRules(r).includes(expected),
    `errors: ${errorRules(r).join(', ') || '(none)'}`)
}

{
  // A PNG renamed to .webp. The filename and the reported MIME type both
  // say WebP; only the bytes say otherwise, which is the whole point of
  // sniffing rather than trusting.
  const r = run('actually-png.webp', { declaredMimeType: 'image/webp' })
  check('renamed PNG identified as png from its bytes', r.header?.format === 'png',
    JSON.stringify(r.header))
  check('renamed PNG warns mime-mismatch', rules(r).includes('mime-mismatch'),
    rules(r).join(', '))
  check('renamed PNG is still accepted (it is a real image)', r.ok,
    errorRules(r).join(', '))
}

{
  const r = run('off-target-768.webp')
  check('768px accepted with an off-target warning',
    r.ok && rules(r).includes('off-target-size'), rules(r).join(', '))
}

{
  // A readable header whose pixel data the decoder refuses.
  const r = run('valid-1024.webp', { decoded: false })
  check('decode failure is a hard error', errorRules(r).includes('undecodable'),
    errorRules(r).join(', '))
}

{
  // Unmeasurable transparency downgrades to a warning rather than silently
  // passing or wrongly failing.
  const r = run('valid-1024-rgba-opaque.png', {
    declaredMimeType: 'image/png',
    transparentFraction: undefined,
  })
  check('unsampled alpha channel warns rather than fails',
    r.ok && rules(r).includes('alpha-unverified'), rules(r).join(', '))
}

{
  // Oversize is caught on byte length, before any decode is attempted.
  const big = new Uint8Array(LEVEL_C_MAX_BYTES + 1)
  big.set(new Uint8Array(readFileSync(join(FIXTURES, 'valid-1024.webp'))))
  const r = validateLevelCUpload({
    fileName: 'huge.webp',
    declaredMimeType: 'image/webp',
    bytes: big,
    decoded: true,
    transparentFraction: 0,
  })
  check('oversize rejected', errorRules(r).includes('max-bytes'), errorRules(r).join(', '))
}

// ---------------------------------------------------------------------------
// Format sniffing
// ---------------------------------------------------------------------------

check('sniff webp', sniffImageFormat(new Uint8Array(readFileSync(join(FIXTURES, 'valid-1024.webp')))) === 'webp')
check('sniff png', sniffImageFormat(new Uint8Array(readFileSync(join(FIXTURES, 'valid-1024.png')))) === 'png')
check('sniff jpeg', sniffImageFormat(new Uint8Array(readFileSync(join(FIXTURES, 'valid-1024.jpg')))) === 'jpeg')
check('sniff rejects text', sniffImageFormat(new TextEncoder().encode('RIFFnope')) === null)
check('sniff rejects empty', sniffImageFormat(new Uint8Array(0)) === null)
check('header of a non-image is null', readImageHeader(new TextEncoder().encode('hello')) === null)

check('webp mime', mimeTypeFor('webp') === 'image/webp')
check('jpeg extension is jpg', extensionFor('jpeg') === 'jpg')

// ---------------------------------------------------------------------------
// Storage paths: the path-traversal surface
// ---------------------------------------------------------------------------

const TOPIC = '6f1b7c6a-2d3e-4a5b-8c9d-0e1f2a3b4c5d'

check('path is <uuid>/<ms>.<ext>',
  topicArtworkStoragePath(TOPIC, 'webp', 1700000000000) === `${TOPIC}/1700000000000.webp`,
  topicArtworkStoragePath(TOPIC, 'webp', 1700000000000))

check('path extension follows the sniffed format, not a filename',
  topicArtworkStoragePath(TOPIC, 'jpeg', 1).endsWith('.jpg'))

const traversals = [
  '../../etc/passwd',
  '..',
  '/etc/passwd',
  `${TOPIC}/../../x`,
  `${TOPIC}%2F..%2Fx`,
  'not-a-uuid',
  '',
  `${TOPIC}\u0000.png`,
  'DROP TABLE media',
]
for (const bad of traversals) {
  let threw = false
  try {
    topicArtworkStoragePath(bad, 'webp', 1)
  } catch {
    threw = true
  }
  check(`storage path refuses ${JSON.stringify(bad)}`, threw, 'it built a path')
}

check('isUuid accepts a real v4 uuid', isUuid(TOPIC))
check('isUuid rejects a slug', !isUuid('mathematics'))

// ---------------------------------------------------------------------------
// Provenance: an upload must never look like an API generation
// ---------------------------------------------------------------------------

check('chatgpt source', externalUploadSource('chatgpt') === 'external_upload:chatgpt')
check('source is slugged', externalUploadSource('  ChatGPT 5 ') === 'external_upload:chatgpt-5')
check('empty source falls back', externalUploadSource('') === 'external_upload:unspecified')
check('upload source never claims api generation',
  !externalUploadSource('gpt-image-1').startsWith('ai_generated'))

// ---------------------------------------------------------------------------

if (failures.length > 0) {
  console.error(`artwork validation check failed (${failures.length} of ${checks}):`)
  for (const f of failures) console.error(`  ${f}`)
  process.exit(1)
}

console.log(
  `artwork validation ok: ${checks} assertions over ${rejections.length + 6} real image fixtures ` +
    `(structural rules only — no check here approves artwork)`,
)
