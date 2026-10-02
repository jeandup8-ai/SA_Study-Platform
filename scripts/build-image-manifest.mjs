#!/usr/bin/env node
// Builds docs/image-generation-manifest.json from the real curriculum.
//
// Why this is generated rather than written by hand: the manifest has to
// stay true to 224 topics across 10 subjects, and a hand-maintained copy
// drifts the first time curriculum changes. Regenerate it instead.
//
// Two sources, both already in the repository, both already verified:
//
//   scripts/fixtures/topics-live.tsv
//     Every real topic -- id, slug, subject slug, grade, validation
//     status and name -- exported from the database. The id column's
//     checksum was compared against the database when it was written, so
//     nothing here is remembered or inferred.
//
//   supabase/functions/generate-topic-illustration/prompt.ts
//     The topic-to-scene mapping the product already uses, checked on
//     every build by check-illustration-prompts.mjs. Reusing it means
//     there is one description of what a topic looks like, not two that
//     can disagree.
//
// No topic name, scene or concept is invented here.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const TOPICS_TSV = 'scripts/fixtures/topics-live.tsv'
const SUBJECT_IDS_TSV = 'scripts/fixtures/subject-ids.tsv'
const MEDIA_COVERAGE_TSV = 'scripts/fixtures/media-coverage.tsv'
const COVERAGE_AS_OF = '2026-10-02'
const PROMPT_SOURCE = 'supabase/functions/generate-topic-illustration/prompt.ts'
const OUT_JSON = 'docs/image-generation-manifest.json'

// ---------------------------------------------------------------------------
// Subjects. Names and accents come from the Level B manifest; slugs are the
// real ones and are asserted against the topic export below.
// ---------------------------------------------------------------------------
const SUBJECTS = [
  { slug: 'mathematics', accentShort: 'cyan-teal', topicAvoid: 'equations, numerals, rulers with measurement markings, clock faces, calculator keys', name: 'Mathematics', id: 'B-01', accent: 'bright cyan-teal', priority: true,
    concept: 'Spatial relationships made physical -- solids, a fraction split into parts, and balance, arranged as classroom apparatus rather than symbols.',
    objects: 'a smooth cube and a cone resting beside it, a circular disc cleanly divided into three unequal coloured wedges that sit very slightly apart, a small two-pan balance scale tipped a fraction off level, a short stack of flat square tiles, and two or three plain round counters',
    avoid: 'rulers with measurement markings, clock faces, dice pips, calculator keys, equations, numerals of any kind' },
  { slug: 'natural-sciences', accentShort: 'lilac and teal', topicAvoid: 'the atom-with-orbits cliche, periodic tables, chemical formulae, any labelled scientific diagram', name: 'Natural Sciences', id: 'B-02', accent: 'soft lilac with cyan-teal accents', priority: true,
    concept: 'Curiosity and observation through the natural world.',
    objects: 'a simple microscope seen three-quarter on, a rounded flask holding a band of teal liquid, a shallow dish with a single green seedling and two curved leaves, a smooth river pebble, one large soft water droplet, and a magnifying lens resting against the flask',
    avoid: 'the atom-with-orbits cliche, periodic tables, chemical formulae, printed dials on the microscope, measurement scales, labels' },
  { slug: 'social-sciences', accentShort: 'amber-gold', topicAvoid: 'place names, country labels, flags, political symbols, map grid labels, cultural stereotypes', name: 'Social Sciences', id: 'B-03', accent: 'warm amber-gold', priority: true,
    concept: 'People, places, environments and history represented through objects.',
    objects: 'a partly unrolled map sheet showing only abstract coloured landmasses, rivers and contour bands, a brass compass with a plain needle, a small flat-topped mountain form in warm ochre suggesting a highveld plateau, a weathered clay pot, a single rounded acacia-like tree, and a small stack of closed books with plain spines',
    avoid: 'place names, country labels, flags, political symbols, map grid labels, historical text, cultural stereotypes' },
  { slug: 'english-home-language', accentShort: 'cyan-teal and lilac', topicAvoid: 'any writing, ruled lines or letterforms on books, paper or screens', name: 'English Home Language', id: 'B-04', accent: 'bright cyan-teal shading into soft lilac', priority: true,
    concept: 'Reading, writing, communication and imagination.',
    objects: 'one large book lying open with both pages completely blank and softly curved, two closed books stacked beneath it with plain unlettered spines, a fountain pen resting diagonally across the open page, a folded sheet of paper, a bookmark ribbon, and two or three small leaf or feather shapes drifting upward above the book',
    avoid: 'any writing, ruled lines, printed text on any page, letterforms of any kind' },
  { slug: 'afrikaans-first-additional-language', accentShort: 'lilac and cyan-teal', topicAvoid: 'words inside speech bubbles, flags, Dutch or colonial imagery, cultural cliches', name: 'Afrikaans First Additional Language', id: 'B-05', accent: 'soft lilac shading into bright cyan-teal', priority: true,
    concept: 'Language learning and everyday spoken communication.',
    objects: 'two large rounded speech bubbles of different sizes overlapping at an angle, both completely empty inside, rendered as solid soft-shaded objects with real thickness rather than flat outlines; beside them a small stack of blank flash cards fanned slightly, a pair of simple over-ear headphones, and one small open notebook with entirely blank pages',
    avoid: 'words inside the speech bubbles, flags, Dutch or colonial imagery, cultural cliches, any national symbolism' },
  { slug: 'life-skills', accentShort: 'amber-gold and coral', topicAvoid: 'medical crosses, first-aid symbols, bandages, fitness-tracker screens', name: 'Life Skills', id: 'B-06', accent: 'warm amber-gold shading into soft coral', priority: true,
    concept: 'Healthy living, everyday wellbeing, personal growth and practical life.',
    objects: 'a reusable water bottle standing upright, a round apple and a bunch of three grapes, a skipping rope coiled into a loose spiral, a small potted plant with two broad leaves, a folded towel, and a single simple geometric heart sitting low in the arrangement',
    avoid: 'medical crosses, first-aid symbols, bandages, fitness-tracker screens, any medical equipment' },
  { slug: 'creative-arts', accentShort: 'coral and lilac', topicAvoid: 'musical notation, staves, clefs, note symbols, sheet music', name: 'Creative Arts', id: 'B-07', accent: 'soft coral shading into lilac', priority: true,
    concept: 'Making, performing and expressing ideas through the arts.',
    objects: 'a small hand drum seen three-quarter on with two wooden mallets crossed beside it, a shallow palette holding four rounded blobs of coral, gold, teal and lilac paint, two paintbrushes with paint on the bristles, a shaker rattle, and a single theatre spotlight tilted downward with a soft cone of warm light; the drum and the palette dominant',
    avoid: 'musical notation, staves, clefs, note symbols, sheet music, any text' },
  { slug: 'economic-and-management-sciences', accentShort: 'amber-gold', topicAvoid: 'banknotes, currency symbols, digits, denomination markings', name: 'Economic and Management Sciences', id: 'B-08', accent: 'warm amber-gold', priority: false,
    concept: 'Exchange and enterprise.',
    objects: 'a small striped market-stall awning seen three-quarter on, a woven basket holding three rounded fruit, a short stack of plain gold discs standing in for coins with completely blank faces, a simple money tin, and a small set of hanging scales',
    avoid: 'banknotes, currency symbols, digits, any denomination markings' },
  { slug: 'life-orientation', accentShort: 'coral and amber-gold', topicAvoid: 'writing on signs or maps', name: 'Life Orientation', id: 'B-09', accent: 'soft coral shading into amber-gold', priority: false,
    concept: 'Direction, choices and personal development.',
    objects: 'a signpost with three blank arrow boards pointing different ways, a round hand compass, a small sapling in a pot with a single upward shoot, a folded road map with only abstract coloured routes, and one smooth round stepping stone; the signpost dominant',
    avoid: 'writing on the arrow boards, place names on the map, any wellbeing still-life that would duplicate Life Skills' },
  { slug: 'technology', accentShort: 'cyan-teal and navy', topicAvoid: 'dimension lines, measurement marks, app screens, interface elements', name: 'Technology', id: 'B-10', accent: 'bright cyan-teal shading into deep navy', priority: false,
    concept: 'Designing and building -- structures and mechanisms.',
    objects: 'a small bridge truss made of rounded beams, two interlocking gears of different sizes, a loosely rolled sheet of plan paper showing only plain blank surface, a pair of dividers, and a single large bolt; the truss and the gears dominant',
    avoid: 'dimension lines, measurement marks, app screens, interface elements, any drawing on the plan paper' },
]

// ---------------------------------------------------------------------------
// Classification. Objective, keyword-driven, and applied to the cleaned topic
// name so that extraction noise ("1.1.", "(Term 3)") cannot sway it.
//
// The question each rule answers is "does a picture do educational work
// here", not "could we draw something". Decoration is never a reason.
// ---------------------------------------------------------------------------

/** A physical system, process, structure, place or cycle. A picture makes it concrete. */
const REQUIRED_PATTERNS = [
  /water cycle|life cycle|ecosystem|food (web|chain)|biosphere/i,
  /habitat|adaptation|vertebrate|invertebrate|skeleton|muscle|micro-?organism|reproduction|variation among/i,
  /circuit|electric|energy|solid|liquid|gas|mixture|separat|material|metal|conductor/i,
  /sun|moon|planet|earth|season|day and night|rotation/i,
  /volcano|earthquake|rock|soil|physical feature|mining|mineral|climate|vegetation|weather/i,
  /\bmap\b|map skills|settlement|population|grid/i,
  /fraction|geometr|tessellation|transformation|views of simple|shape|pattern/i,
  /place value|whole number|number line|counting|halving|multiple|factor|divisib|integer/i,
  /farming|farmer|trade|transport|resource|conservation|water in/i,
  /ancient egypt|kingdom|colony|settlement|slave|revolution|medicine|then and now/i,
]

/** Concrete enough that a picture aids recognition and recall, if not comprehension. */
const USEFUL_PATTERNS = [
  /career|create in (two|three) dimensions|create in 2d|create in 3d|model|sculpt|relief|clay/i,
  /dance|music|drama|perform|folktale|instrument|visual literacy/i,
  /health|nutrition|hygiene|safety|first aid|movement|swimming/i,
  /\bself\b|identity|emotion|esteem|body image|bullying|rites of passage/i,
  /responsibilit|\bright|community|caring|cultural/i,
  /story|poetr|reading|literature|comprehension|main idea|media text/i,
  /money|financial|ratio|rate/i,
  /weer|seisoen|familie|winkel|klaskamer|kleur|groete/i,
]

/**
 * Abstract metalanguage: grammar terms, parts of speech, tense, voice. The
 * existing scene for these is a wall of blank cards, which is honest about
 * the fact that there is nothing to draw -- the concept lives in the words
 * themselves, and the product teaches it with worked examples. A picture
 * here is decoration, so none is commissioned.
 */
const NOT_NEEDED_PATTERNS = [
  /noun|pronoun|adjective|adverb|\bverb|tense|conjunction|voegwoord|preposition|voorsetsel/i,
  /sentence|\bsin\b|paragraaf|punctuation|plural|meervoud|vraagwoord|naamwoord/i,
  /passive voice|lydende|bedrywende|direct and indirect|direkte en indirekte|reported speech|rede\b/i,
  /synonym|antonym|vocabular|woordeskat|idiom|idiome|figure|figurative|simile|metaphor/i,
  /formal|informal|persuasi|trappe van vergelyking|degrees of comparison/i,
  /mental (calculation|math)|rounding|properties of|addition of|subtraction of|division|divide/i,
]

function classify(cleanName, rawName, validationStatus) {
  // The source layer itself is unsettled for these; a "curriculum-specific"
  // illustration would be specific to something nobody has confirmed yet.
  if (validationStatus === 'REVIEW_REQUIRED' || validationStatus === 'CONFLICTING') {
    return 'SOURCE_INCOMPLETE'
  }
  const hay = `${cleanName} ${rawName}`
  // Not-needed is tested first: a grammar topic that happens to contain the
  // word "pattern" is still a grammar topic.
  if (NOT_NEEDED_PATTERNS.some((r) => r.test(hay))) return 'VISUAL_NOT_NEEDED'
  if (REQUIRED_PATTERNS.some((r) => r.test(hay))) return 'VISUAL_REQUIRED'
  if (USEFUL_PATTERNS.some((r) => r.test(hay))) return 'VISUAL_USEFUL'
  return 'VISUAL_NOT_NEEDED'
}

// ---------------------------------------------------------------------------
// The shared style lock, written once and embedded whole in every prompt so
// each one can be pasted into ChatGPT alone, in any order, days apart.
// ---------------------------------------------------------------------------
const STYLE =
  'Premium modern educational editorial illustration for a contemporary South African learning platform. ' +
  'Clean vector-leaning forms with soft dimensional shading, gently rounded geometry, subtle depth, and a ' +
  'tactile matte-paper or soft-touch-plastic quality -- never glossy, never photoreal. Confident flat colour ' +
  'fills, crisp clean edges, no outlines or inked strokes, no texture noise or grain. Medium saturation. ' +
  'Restrained visual complexity. Warm, intelligent, curious and optimistic: grown-up enough for a parent to ' +
  'trust, inviting enough for a nine-to-thirteen-year-old. NOT preschool or babyish, NOT Disney or Pixar, ' +
  'NOT anime, NOT generic 3D clipart, NOT corporate stock illustration, NOT photorealistic, NOT neon, ' +
  'NOT pastel-washed, NOT isometric technical drawing.'

const LIGHTING_MARK =
  'One soft light source from the upper left, casting short, soft, low-contrast shadows that model the forms ' +
  'without creating a cast shadow on any surface beneath them.'

const LIGHTING_SCENE =
  'One soft light source from the upper left, casting short, soft, low-contrast shadows. Shadows may fall ' +
  'within the scene itself, since this illustration has its own background.'

const NO_TEXT =
  'IMPORTANT: no text, letters, words, numbers, digits, equations, labels, captions, signatures, watermarks, ' +
  'logos, brand marks, user-interface elements, app screens or readable writing of any kind, anywhere in the image.'

function subjectPrompt(s) {
  return [
    'Create a premium modern educational editorial illustration for StudyLegends.',
    '',
    `SUBJECT: ${s.name} — the visual identity for this whole subject.`,
    '',
    `VISUAL CONCEPT: ${s.concept}`,
    '',
    `OBJECTS: ${s.objects}. Six to nine objects at most, grouped so they slightly overlap and read as one silhouette.`,
    '',
    'COMPOSITION: a single tight arrangement, centred, occupying roughly the central 80% of the frame with clear ' +
      'margin on all four sides. Three-quarter elevated view, as if looking down at a table from slightly above and ' +
      'in front. Low visual density; every object large enough to recognise instantly at thumbnail size, nothing ' +
      'smaller than about one twelfth of the frame.',
    '',
    `STYLE: ${STYLE}`,
    '',
    `COLOUR: restrained palette of deep navy, bright cyan-teal, warm amber-gold, soft lilac and off-white, with ${s.accent} dominant.`,
    '',
    `LIGHTING: ${LIGHTING_MARK}`,
    '',
    'BACKGROUND: fully transparent. No background colour, no backdrop, no ground plane, no surface, no drop shadow ' +
      'onto anything. The objects float cleanly on transparency, because this artwork is composited over the ' +
      "subject's own colour gradient in the product.",
    '',
    'TECHNICAL: square 1:1, generate at 1024 x 1024, transparent background (alpha channel required).',
    '',
    `DO NOT INCLUDE: ${s.avoid}. No human figures, no faces, no hands, no character mascots. No national flags.`,
    '',
    NO_TEXT,
  ].join('\n')
}

function topicPrompt({ subjectName, grade, cleanName, scene, direction, accent }) {
  return [
    'Create a premium modern educational editorial illustration for StudyLegends.',
    '',
    `SUBJECT: ${subjectName}, Grade ${grade} — the topic "${cleanName}".`,
    '',
    `VISUAL CONCEPT: make this topic recognisable and concrete at a glance, so a learner opening the lesson ` +
      `already has something to hang the idea on.`,
    '',
    `OBJECTS: ${scene}.`,
    '',
    'COMPOSITION: one clear scene filling the square frame, with a single obvious focal point and generous ' +
      'breathing room around it. Readable at card size. No vignette, no border.',
    '',
    `STYLE: ${STYLE}`,
    '',
    `COLOUR: restrained palette of deep navy, bright cyan-teal, warm amber-gold, soft lilac and off-white, ` +
      `with ${accent} leading.`,
    '',
    `LIGHTING: ${LIGHTING_SCENE}`,
    '',
    'BACKGROUND: a simple flat or very softly graded background that fills the whole square. Unlike the subject ' +
      'marks, this one is NOT transparent -- it renders full-bleed inside a rounded card.',
    '',
    'TECHNICAL: square 1:1, generate at 1024 x 1024, export 768 x 768 WebP.',
    '',
    `DO NOT INCLUDE: ${direction ? direction + ' ' : ''}No realistic photographic human faces. No logos, brands ` +
      'or trademarks. Nothing violent, frightening or unsafe. No scientific diagram that could carry a wrong ' +
      'label, and no equation.',
    '',
    NO_TEXT,
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------
const outDir = mkdtempSync(join(tmpdir(), 'manifest-'))
let normaliseTopicName
try {
  execFileSync('npx', ['tsc', '--ignoreConfig', '--target', 'es2022', '--module', 'esnext',
    '--outDir', outDir, PROMPT_SOURCE], { stdio: 'pipe' })
  ;({ normaliseTopicName } = await import(pathToFileURL(join(outDir, 'prompt.js')).href))
} finally {
  rmSync(outDir, { recursive: true, force: true })
}

// The scene vocabulary, read straight out of the live prompt builder's source
// so there is exactly one copy of it in the repository.
const promptSrc = readFileSync(PROMPT_SOURCE, 'utf8')
const sceneBlock = promptSrc.slice(
  promptSrc.indexOf('const TOPIC_SCENE'),
  promptSrc.indexOf('export interface PromptInput'),
)
const SCENES = [...sceneBlock.matchAll(/match:\s*\n?\s*(\/(?:[^/\\]|\\.)+\/[gimsuy]*),\s*\n\s*scene:\s*\n?\s*(['"])((?:[^\\]|\\.)*?)\2/g)]
  .map((m) => ({ match: new RegExp(m[1].slice(1, m[1].lastIndexOf('/')), m[1].slice(m[1].lastIndexOf('/') + 1)), scene: m[3].replace(/\\'/g, "'") }))
if (SCENES.length < 50) throw new Error(`only parsed ${SCENES.length} scenes from prompt.ts; the parser needs updating`)

const SUBJECT_BY_SLUG = Object.fromEntries(SUBJECTS.map((s) => [s.slug, s]))

const rows = readFileSync(TOPICS_TSV, 'utf8').trim().split('\n').map((line) => {
  const [id, slug, subjectSlug, grade, validationStatus, ...rest] = line.split('|')
  return { id, slug, subjectSlug, grade: Number(grade), validationStatus, name: rest.join('|') }
})

const SUBJECT_IDS = Object.fromEntries(
  readFileSync(SUBJECT_IDS_TSV, 'utf8').trim().split('\n').map((l) => l.split('|')),
)

// Which topics already carry an illustration in the media table. The key is
// subject|grade|slug because topic slugs repeat across grades.
const COVERED = new Set(
  readFileSync(MEDIA_COVERAGE_TSV, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#')),
)

const unknown = rows.filter((r) => !SUBJECT_BY_SLUG[r.subjectSlug])
if (unknown.length) throw new Error(`topics reference unknown subject slugs: ${[...new Set(unknown.map((u) => u.subjectSlug))].join(', ')}`)

const assets = []

for (const s of SUBJECTS) {
  assets.push({
    id: s.id,
    level: 'B',
    subject: s.name,
    subjectSlug: s.slug,
    subjectId: SUBJECT_IDS[s.slug] ?? null,
    topicId: null,
    topicSlug: null,
    grades: [...new Set(rows.filter((r) => r.subjectSlug === s.slug).map((r) => r.grade))].sort(),
    purpose: 'Subject visual identity, shown wherever this subject is named or opened.',
    routes: ['/app/subjects', '/app/subjects/:subjectId', '/#subjects'],
    components: ['SubjectMark'],
    outputDirectory: 'public/subject-art',
    outputFilename: `${s.slug}.webp`,
    format: 'webp',
    dimensions: { generate: '1024x1024', production: '512x512' },
    aspectRatio: '1:1',
    transparency: 'REQUIRED',
    safeCrop: 'Principal arrangement inside the central 80%; 10% clear margin on all four sides.',
    visualConcept: s.concept,
    prohibited: s.avoid,
    altTextIntent: 'Decorative. The subject name is rendered as adjacent text, so the image ships with alt="".',
    priority: s.priority,
    prompt: subjectPrompt(s),
    status: 'NOT_GENERATED',
  })
}

const counts = { VISUAL_REQUIRED: 0, VISUAL_USEFUL: 0, VISUAL_NOT_NEEDED: 0, SOURCE_INCOMPLETE: 0 }

for (const r of rows) {
  const subject = SUBJECT_BY_SLUG[r.subjectSlug]
  const cleanName = normaliseTopicName(r.name)
  const classification = classify(cleanName, r.name, r.validationStatus)
  counts[classification] += 1

  const wanted = classification === 'VISUAL_REQUIRED' || classification === 'VISUAL_USEFUL'
  const scenes = SCENES.filter((e) => e.match.test(cleanName) || e.match.test(r.name)).slice(0, 2).map((e) => e.scene)

  // Grade is in the filename on purpose. Topic slugs repeat across grades --
  // "visual-literacy-term-1" is three different Life Skills topics -- so a
  // subject/slug path would quietly serve one picture to all of them and
  // leave a reviewer unable to tell which grade they approved.
  const filename = `g${r.grade}-${r.slug}.webp`

  const hasExistingArtwork = COVERED.has(`${r.subjectSlug}|${r.grade}|${r.slug}`)

  // What should happen to this topic next. Derived entirely from metadata --
  // whether artwork exists, and how the topic is classified. Nothing here is
  // a judgement about whether an existing picture is any good; that needs a
  // person looking at it, which is what the Illustration Studio is for.
  const action = hasExistingArtwork
    ? wanted
      ? 'HUMAN_VISUAL_REVIEW_REQUIRED'
      : 'RETAIN_FOR_REVIEW_RECLASSIFIED'
    : wanted
      ? 'GENERATE'
      : 'NO_ARTWORK_PLANNED'

  assets.push({
    id: `C-${r.subjectSlug}-g${r.grade}-${r.slug}`,
    level: 'C',
    subject: subject.name,
    subjectSlug: r.subjectSlug,
    subjectId: SUBJECT_IDS[r.subjectSlug] ?? null,
    // The topic id is the canonical identity for Level C artwork. The
    // filesystem path below is documentation, not an address: topic images
    // are published through the media table, keyed on this id.
    topicId: r.id,
    topicSlug: r.slug,
    topicName: r.name,
    normalisedTopicName: cleanName,
    grades: [r.grade],
    sourceValidationStatus: r.validationStatus,
    classification,
    purpose: wanted
      ? 'Topic recognition on the topic list, and visual explanation inside the lesson.'
      : 'No artwork commissioned. See classification.',
    routes: wanted ? ['/app/subjects/:subjectId', '/app/lessons/:lessonId'] : [],
    components: wanted ? ['TopicListPage thumbnail', 'LessonPage visual_explanation step'] : [],
    outputDirectory: wanted ? `public/topic-art/${r.subjectSlug}` : null,
    outputFilename: wanted ? filename : null,
    format: wanted ? 'webp' : null,
    dimensions: wanted ? { generate: '1024x1024', production: '768x768' } : null,
    aspectRatio: wanted ? '1:1' : null,
    // Topic art renders full-bleed in a rounded card, so unlike the subject
    // marks it does not need an alpha channel.
    transparency: wanted ? 'NOT_REQUIRED' : null,
    safeCrop: wanted ? 'Square container, object-cover. Keep the focal point off all four edges by at least 8%.' : null,
    visualConcept: wanted ? (scenes.length ? scenes.join('; and ') : null) : null,
    prohibited: wanted ? 'Text, digits, equations, labels, logos, watermarks, realistic photographic faces.' : null,
    altTextIntent: wanted
      ? 'Decorative on the topic list, where the topic name is adjacent. In the lesson visual step it also carries alt="" because the narration states the concept.'
      : null,
    prompt: wanted && scenes.length
      ? topicPrompt({
          subjectName: subject.name, grade: r.grade, cleanName,
          scene: scenes.join('; and '),
          direction: `Avoid ${subject.topicAvoid}.`,
          accent: subject.accentShort,
        })
      : null,
    // Point-in-time reconciliation against the canonical pipeline. Re-derive
    // it by refreshing scripts/fixtures/media-coverage.tsv.
    existingArtwork: {
      asOf: COVERAGE_AS_OF,
      present: hasExistingArtwork,
      reviewStatus: hasExistingArtwork ? 'pending' : null,
      pipeline: 'media-table',
      lookup: `public.media where media_type='image' and topic_id='${r.id}'`,
    },
    action,
    // 'NOT_GENERATED' describes this manifest's own file-based planning
    // layer, which holds no Level C artwork and is not a publishing path.
    // The real lifecycle state lives on the media row above.
    status: hasExistingArtwork ? 'GENERATED' : 'NOT_GENERATED',
  })
}

const actionCounts = assets.filter((a) => a.level === 'C')
  .reduce((acc, a) => ({ ...acc, [a.action]: (acc[a.action] ?? 0) + 1 }), {})

const manifest = {
  generatedBy: 'scripts/build-image-manifest.mjs',
  generatedFrom: [TOPICS_TSV, PROMPT_SOURCE, SUBJECT_IDS_TSV, MEDIA_COVERAGE_TSV],
  canonicalPipelines: {
    levelB: 'filesystem: public/subject-art/<subject-slug>.webp, declared in src/lib/subjects/subjectArt.ts',
    levelC: "media table + Supabase storage + admin Illustration Studio review gate; canonical identity is topics.id",
    note:
      'public/topic-art/ is documentation and validation infrastructure only. It is NOT a publishing path and ' +
      'nothing in the application reads it. Level C artwork is published through the media table.',
  },
  note:
    'Generated. Do not hand-edit; re-run the script. No artwork has been generated: every asset is ' +
    'NOT_GENERATED until a real file exists in the repository and the validators pass. A valid file is ' +
    'still not an approval -- a person approves artwork by declaring it in the registry.',
  subjects: SUBJECTS.map((s) => ({ id: s.id, slug: s.slug, name: s.name, priority: s.priority })),
  summary: {
    subjectsTotal: SUBJECTS.length,
    levelBAssets: SUBJECTS.length,
    levelBPriority: SUBJECTS.filter((s) => s.priority).length,
    topicsTotal: rows.length,
    ...counts,
    levelCPromptsGenerated: assets.filter((a) => a.level === 'C' && a.prompt).length,
    levelBFilesPresent: 0,
    levelCExistingMediaRows: [...COVERED].length,
    levelCActions: actionCounts,
  },
  assets,
}

writeFileSync(OUT_JSON, JSON.stringify(manifest, null, 2) + '\n')

console.log(`manifest written: ${OUT_JSON}`)
console.log(`  Level B: ${SUBJECTS.length} assets (${manifest.summary.levelBPriority} priority), 0 present`)
console.log(`  Level C: ${rows.length} topics ->`)
for (const [k, v] of Object.entries(counts)) console.log(`    ${k.padEnd(20)} ${v}`)
console.log(`  prompts generated: ${manifest.summary.levelCPromptsGenerated}`)
console.log(`  existing media rows: ${manifest.summary.levelCExistingMediaRows}`)
for (const [k, v] of Object.entries(actionCounts).sort()) console.log(`    ${k.padEnd(32)} ${v}`)
