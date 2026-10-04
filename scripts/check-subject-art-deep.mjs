#!/usr/bin/env node
// Pixel-level inspection of declared Level B subject artwork.
//
// WHY THIS IS SEPARATE FROM check-subject-art.mjs. That one reads the WebP
// container header, which is all Node can do without an image decoder: it
// answers "is this really a 512-square WebP that declares an alpha
// channel". That is necessary and it is not sufficient, and a real
// candidate proved it.
//
// The B-01 Mathematics candidate generated in ChatGPT passed the header
// check cleanly -- 512x512, genuine lossy WebP, alpha flag set, 60KB. Its
// actual pixels told a different story: not one pixel in the entire image
// reached full opacity (the subject sat at alpha 253), and roughly half the
// frame was partial alpha forming a wide feathered halo with coloured
// fringing. That is the signature of artwork keyed out of a background it
// was generated against, rather than rendered onto transparency. Composited
// over the subject's colour gradient in `SubjectMark`, it shows as a
// washed, grubby ring around the mark -- subtle enough to ship by accident,
// obvious enough to look cheap once it has.
//
// A header cannot see that. A decoder can, so this uses the Chromium that
// is already installed for the browser QA, and is deliberately NOT part of
// `prebuild`: a build should not need a browser. Run it by hand before
// declaring a new subject mark, which is the moment the question matters.
//
// It still does not judge the picture. "Properly opaque with a clean edge"
// is not "a person looked at this and approved it for children".
import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const SOURCE = 'src/lib/subjects/subjectArt.ts'
const CHROME = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'

// A mark is composited over a colour gradient. Its solid body must actually
// be solid; if nothing is, the whole thing is translucent.
const MIN_FULLY_OPAQUE_FRACTION = 0.05
// Anti-aliasing on a 512px mark is a thin rim. Half the frame in partial
// alpha is a feathered cut-out, not an edge.
const MAX_SOFT_EDGE_FRACTION = 0.22
// Transparency is the point; a mark that fills the frame has a background.
const MIN_TRANSPARENT_FRACTION = 0.1

const outDir = mkdtempSync(join(tmpdir(), 'subject-art-deep-'))
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

const declared = Object.entries(SUBJECT_SKINS).filter(([, skin]) => skin.art)

if (declared.length === 0) {
  console.log('subject art deep check: nothing declared yet, nothing to inspect')
  process.exit(0)
}

if (!existsSync(CHROME)) {
  console.error(`subject art deep check: no Chromium at ${CHROME}.`)
  console.error('  Set CHROME_PATH, or skip this check — it is not part of the build.')
  process.exit(1)
}

const { chromium } = await import('playwright')
const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage()

const problems = []
const measured = []

for (const [slug, skin] of declared) {
  const file = join('public', skin.art.src.slice(1))
  if (!existsSync(file)) continue // check-subject-art.mjs already fails on this

  const dataUrl = `data:image/webp;base64,${readFileSync(file).toString('base64')}`
  const stats = await page.evaluate(async (src) => {
    const img = new Image()
    img.src = src
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0)
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    let clear = 0
    let soft = 0
    let solid = 0
    let maxAlpha = 0
    for (let i = 3; i < data.length; i += 4) {
      const a = data[i]
      if (a > maxAlpha) maxAlpha = a
      if (a === 0) clear++
      else if (a === 255) solid++
      else soft++
    }
    const total = data.length / 4
    return {
      width: canvas.width,
      height: canvas.height,
      maxAlpha,
      clear: clear / total,
      soft: soft / total,
      solid: solid / total,
    }
  }, dataUrl)

  const pct = (n) => `${(n * 100).toFixed(1)}%`
  measured.push(
    `  ${slug}: ${pct(stats.solid)} solid, ${pct(stats.soft)} soft edge, ` +
      `${pct(stats.clear)} clear, peak alpha ${stats.maxAlpha}`,
  )

  if (stats.solid < MIN_FULLY_OPAQUE_FRACTION) {
    problems.push(
      `${slug}: only ${pct(stats.solid)} of the image is fully opaque (peak alpha ` +
        `${stats.maxAlpha}/255). The mark is translucent, so the subject's gradient ` +
        `will show through the artwork itself. This is what a background removed ` +
        `from a generated image looks like — re-export rendered on transparency ` +
        `rather than keyed out.`,
    )
  }
  if (stats.soft > MAX_SOFT_EDGE_FRACTION) {
    problems.push(
      `${slug}: ${pct(stats.soft)} of the image is partially transparent. That is a ` +
        `feathered halo, not an anti-aliased edge, and it will read as a grubby ring ` +
        `around the mark once it sits on the subject colour.`,
    )
  }
  if (stats.clear < MIN_TRANSPARENT_FRACTION) {
    problems.push(
      `${slug}: only ${pct(stats.clear)} of the image is fully transparent. A subject ` +
        `mark is a group of objects with clear space around them, not a filled square.`,
    )
  }
}

await browser.close()

console.log('measured:')
for (const m of measured) console.log(m)

if (problems.length > 0) {
  console.error(`\nsubject art deep check failed (${problems.length}):`)
  for (const p of problems) console.error(`  ${p}`)
  console.error('\n  These are structural defects in the file, not opinions about the')
  console.error('  picture. Visual approval is still a separate human step.')
  process.exit(1)
}

console.log(`\nsubject art deep check ok: ${declared.length} declared mark(s) are cleanly cut`)
