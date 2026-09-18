#!/usr/bin/env node
// Regression check for the topic-illustration prompt builder.
//
// The builder turns a CAPS topic name into an image prompt. Those names come
// from PDF extraction and are full of noise -- clause numbers, "Topic 2:"
// prefixes, "(Term 3)" suffixes, stray digit runs. Two things must hold for
// every topic, and neither is visible by reading the builder:
//
//   1. Every topic gets a topic-specific scene, not just generic subject
//      direction. Without this, "The water cycle" and "Trade" produce
//      interchangeable classroom pictures.
//   2. No digit survives into the part of the prompt that describes the
//      subject matter. The image must contain no text or numerals at all,
//      and a prompt reading "1 million, 1 milliard, 1 billion" works directly
//      against that.
//
// The fixture is a snapshot of every real topic in the database. It can drift
// as curriculum is added; refresh it from `topics` where is_demo_content is
// false. A drifted fixture makes this check weaker, never wrong.
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const SOURCE = 'supabase/functions/generate-topic-illustration/prompt.ts'
const FIXTURE = 'scripts/fixtures/topics.json'

const outDir = mkdtempSync(join(tmpdir(), 'prompt-check-'))
let buildIllustrationPrompt
try {
  execFileSync(
    'npx',
    ['tsc', '--ignoreConfig', '--target', 'es2022', '--module', 'esnext', '--outDir', outDir, SOURCE],
    { stdio: 'pipe' },
  )
  ;({ buildIllustrationPrompt } = await import(pathToFileURL(join(outDir, 'prompt.js')).href))
} finally {
  rmSync(outDir, { recursive: true, force: true })
}

const topics = JSON.parse(readFileSync(FIXTURE, 'utf8'))
const problems = []

for (const topic of topics) {
  const prompt = buildIllustrationPrompt(topic)
  const where = `G${topic.gradeNumber} ${topic.subjectName}: ${topic.topicName}`

  // "Depict ..." is only emitted when a topic-specific scene matched.
  if (!prompt.includes('Depict ')) {
    problems.push(`no topic-specific scene — ${where}`)
  }

  // The whole prompt, not just the topic clause: a prompt that demands an
  // image with no numerals while itself containing "Grade 4" and "aged 9 to
  // 13" is asking the model to hold two things at once. The rule is absolute
  // so that this check can be exact.
  const digit = prompt.match(/\d/)
  if (digit) {
    problems.push(`digit "${digit[0]}" reached the prompt — ${where}`)
  }
}

// Subject precedence. "Social Sciences" contains the word "science", so an
// entry ordering mistake silently sends every history topic to the science
// direction. Nothing about reading the file makes that visible.
const socialPrompt = buildIllustrationPrompt({
  topicName: 'Dutch settlement and slavery at the Cape',
  subjectName: 'Social Sciences',
  gradeNumber: 7,
})
if (!socialPrompt.includes('recognisably South African landscape')) {
  problems.push('Social Sciences is matching the natural-sciences direction — check SUBJECT_DIRECTION order')
}

if (problems.length > 0) {
  console.error(`illustration prompt check failed (${problems.length}):`)
  for (const problem of problems) console.error(`  ${problem}`)
  process.exit(1)
}
console.log(`illustration prompts ok: ${topics.length} topics, all with a topic-specific scene`)
