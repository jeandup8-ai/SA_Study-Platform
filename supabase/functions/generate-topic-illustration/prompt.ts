// Builds the image prompt for one topic.
//
// This lives server-side, and the hard constraints are appended last and are
// not overridable by the caller. The admin UI can suggest a scene, but it
// cannot switch off "no text" or "no realistic faces" -- those are product
// safety rules, not styling preferences:
//
//   - No text of any kind. Image models still render letters and digits
//     unreliably, and a curriculum product cannot risk a child reading a
//     garbled or wrong label as real content. Anything needing accurate text
//     (a labelled diagram, a flowchart) must be a real UI component.
//   - No realistic human faces, no logos, no brands, nothing frightening.

/**
 * Grade numbers, spelled out.
 *
 * The prompt asks for an image with no numerals in it at all, so the prompt
 * itself contains no numerals either -- a request that says "Grade 4 ... no
 * digits anywhere" is asking the model to hold two things at once, and the
 * check in scripts/check-illustration-prompts.mjs can only be exact if the
 * rule is absolute.
 */
const GRADE_WORDS: Record<number, string> = {
  1: 'one',
  2: 'two',
  3: 'three',
  4: 'four',
  5: 'five',
  6: 'six',
  7: 'seven',
  8: 'eight',
  9: 'nine',
}

/** Century ordinals that appear in CAPS history topic names. */
const ORDINAL_WORDS: Record<string, string> = {
  '10th': 'tenth',
  '11th': 'eleventh',
  '12th': 'twelfth',
  '13th': 'thirteenth',
  '14th': 'fourteenth',
  '15th': 'fifteenth',
  '16th': 'sixteenth',
  '17th': 'seventeenth',
  '18th': 'eighteenth',
  '19th': 'nineteenth',
}

/**
 * Topic names come from CAPS PDF extraction and carry a lot of noise:
 * "1.1. Whole numbers DIVISION", "Topic 2: Create in 3D, self and others",
 * "Visual literacy (Term 3)", "Emphasize: The special names for very large
 * numbers: 1 million, 1 milliard, 1 billion, 1 trillion".
 *
 * Passing those through verbatim is worse than unhelpful. The clause numbers
 * mean nothing to an image model, and a name full of digits actively pushes
 * against the one constraint that matters most here -- that the image must
 * contain no text or numerals at all. So the name is cleaned before it is
 * ever put in front of the model.
 */
export function normaliseTopicName(raw: string): string {
  let name = raw
    // "2D" / "3-D" / "simple3-D" are meaningful, but leaving the digit in
    // invites the model to render it as a label. Spelled out, it survives the
    // digit strip below and reads better in the prompt.
    .replace(/(\d)\s*-?\s*D\b/g, (_m, d: string) =>
      d === '2'
        ? 'two-dimensional'
        : d === '3'
          ? 'three-dimensional'
          : `${d}-dimensional`,
    )
    // "in two-dimensional" is what the rule above leaves behind; the noun
    // form is what a person would actually say.
    .replace(/\bin (two|three)-dimensional\b/gi, 'in $1 dimensions')
    // Ordinals: "15th century" would otherwise leave a digit in the prompt.
    .replace(/\b1[0-9]th\b/g, (m) => ORDINAL_WORDS[m] ?? m)
    // Leading CAPS clause numbers: "1.1.", "2.1", "3.3".
    .replace(/^\s*\d+(\.\d+)*\.?\s*/, '')
    // "Topic 1:", "Topic 2:" prefixes used throughout Life Skills.
    .replace(/^\s*Topic\s+\d+\s*:\s*/i, '')
    // Editorial lead-ins from the source documents.
    .replace(/^\s*(Emphasize|Example|Note)\s*:?\s*/i, '')
    // Term markers. "(Term 3)" is pure noise, but "(Term 2: Emotions)" carries
    // the only thing distinguishing four otherwise identically named topics,
    // so the qualifier is kept and the term number dropped.
    .replace(/\s*\(Term\s+\d+\s*:\s*([^)]+)\)\s*/gi, ' — $1 ')
    .replace(/\s*\(Term\s+\d+\s*\)\s*/gi, ' ')
    // Enumeration stubs left by extraction: "a) b) c) d)".
    .replace(/(?:\b[a-z]\)\s*){2,}/gi, ' ')
    // Any remaining standalone digit runs -- clause or place-value artefacts,
    // never something the picture should show.
    .replace(/\b\d[\d\s,]*\b/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s:;,.\-—]+$/, '')
    .trim()

  // Some names are a clause number and nothing else once cleaned.
  if (name.length < 3) name = raw.trim()
  return name
}

/**
 * Broad direction per subject family, matched on the subject name.
 *
 * Order is precedence: the first match wins. "Social Sciences" contains the
 * word "science", so the social-sciences entry must be tested before the
 * natural-sciences one -- otherwise every history topic asks for laboratory
 * apparatus.
 */
const SUBJECT_DIRECTION: { match: RegExp; direction: string }[] = [
  {
    match: /math/i,
    direction:
      'Show concrete classroom maths materials rather than symbols: counting beads, base-ten blocks, ' +
      'fraction circles, a balance scale, measuring jugs, coins shown as plain discs, geometric shapes ' +
      'and pattern tiles arranged neatly on a desk.',
  },
  {
    match: /social science|history|geograph/i,
    direction:
      'Set the scene in a recognisably South African landscape or streetscape -- highveld grassland, ' +
      'Cape mountains, a small town, a busy market -- with period-appropriate detail where the topic is ' +
      'historical. Maps and globes may appear as shapes and colours only, never with place names.',
  },
  {
    match: /natural science|science|technology/i,
    direction:
      'Show a curious, hands-on science scene: simple apparatus, plants, animals, weather, or everyday ' +
      'materials being observed, with a sense of investigation rather than a finished textbook diagram.',
  },
  {
    match: /english|afrikaans|language|home language|additional language/i,
    direction:
      'Show reading and storytelling: open books with blank pages, a reading corner, speech shown as ' +
      'empty rounded speech bubbles, letters suggested only as abstract marks, never as readable words.',
  },
  {
    match: /creative arts|arts|music|drama|dance/i,
    direction:
      'Show children performing or making art together: dancing, drumming, acting on a simple stage, ' +
      'or painting and modelling at a classroom table. Instruments and props may appear; sheet music ' +
      'and any notation must not.',
  },
  {
    match: /life skills|life orientation/i,
    direction:
      'Show everyday South African family and community life: sharing a meal, playing sport, helping a ' +
      'neighbour, looking after a pet, keeping healthy.',
  },
]

/**
 * Concrete scene elements for topic wording that recurs across CAPS.
 * Matched against the topic name, most specific first. Several can apply;
 * the first two matches are used so the prompt stays focused.
 */
const TOPIC_SCENE: { match: RegExp; scene: string }[] = [
  {
    match: /water cycle/i,
    scene:
      'clouds, rain falling on hills, a river running to the sea, and sunlight drawing mist upward',
  },
  {
    match: /life cycle/i,
    scene: 'the stages of one animal arranged in a ring, egg through to adult',
  },
  {
    match: /food (web|chain)|ecosystem/i,
    scene: 'grassland animals and plants connected by curved arrows',
  },
  {
    match: /vertebrate|invertebrate|skeleton|bones|muscle/i,
    scene: 'a friendly cutaway of an animal showing its bones, beside insects and a fish',
  },
  {
    match: /habitat|adaptation/i,
    scene:
      'four small vignettes -- desert, ocean, polar ice and grassland -- each with its animal',
  },
  {
    match: /micro-?organism|bacteria|mould|yeast/i,
    scene:
      'a microscope on a bench with oversized friendly rounded microbe shapes floating above it',
  },
  {
    match: /electric|circuit|energy transfer/i,
    scene: 'a simple battery, wires and a glowing bulb laid out on a desk',
  },
  {
    match: /energy|fuel|renewable/i,
    scene: 'wind turbines on a hill, solar panels on a roof, and the sun above',
  },
  {
    match: /sun|light|heat|shadow/i,
    scene:
      'a bright sun over a schoolyard with long shadows stretching from a tree and a child',
  },
  {
    match: /solid|liquid|gas|matter|mixture|separat/i,
    scene:
      'three glass containers on a bench holding ice, water and steam, with a sieve and filter beside them',
  },
  {
    match: /metal|non-?metal|material|propert/i,
    scene: 'a tray of sorted materials -- wood, metal, fabric, plastic, glass, clay',
  },
  {
    match: /earth|planet|moon|space|solar system/i,
    scene: 'the Earth and Moon in space with the sun beyond, no writing on anything',
  },
  {
    match: /rock|soil|volcano|earthquake/i,
    scene:
      'a cutaway hillside showing rock layers, with a smoking volcano in the distance',
  },
  {
    match: /weather|climate|vegetation/i,
    scene: 'one landscape shown in four weather moods across the seasons',
  },
  {
    match: /\bmap|settlement|population/i,
    scene:
      'an unlabelled stylised map shape with small buildings, roads and rivers drawn on it',
  },
  {
    match: /trade|market|money|economy/i,
    scene: 'a busy open-air market with stalls, baskets of produce and shoppers',
  },
  {
    match: /farm|agricult|resource|conservation/i,
    scene: 'farmland with crops, a windpump, cattle and hills behind',
  },
  {
    match: /transport|travel|ship|journey/i,
    scene: 'a sailing ship on the ocean with a coastline in the distance',
  },
  {
    match: /fraction|decimal|percent/i,
    scene: 'fraction circles and strips laid out on a desk beside a measuring jug',
  },
  {
    match: /place value|whole number|counting|number pattern/i,
    scene: 'base-ten blocks and counting beads sorted into neat groups on a desk',
  },
  {
    match: /shape|geometr|angle|symmetr/i,
    scene: 'wooden pattern blocks and shape tiles arranged into a design',
  },
  {
    match: /measure|\bmass\b|length|capacity|\btime\b/i,
    scene:
      'a balance scale, a measuring tape, a jug of water and a sand timer on a bench',
  },
  {
    match: /reading|story|comprehension|poem|literature/i,
    scene: 'a cosy reading corner with cushions and open books with blank pages',
  },
  {
    match: /writ(e|ing)|paragraph|essay|letter/i,
    scene: 'a desk with a notebook of blank pages, pencils and an eraser',
  },
  {
    match: /speech|conversation|listening|oral/i,
    scene: 'two children talking, with empty rounded speech bubbles between them',
  },
  {
    match: /health|nutrition|hygiene|safety|first aid/i,
    scene: 'a table of fresh fruit and vegetables with a water bottle and a washbasin',
  },
  {
    match: /dance|movement|choreograph/i,
    scene: 'children dancing together in a school hall, mid-movement',
  },
  {
    match: /music|instrument|rhythm|listening|composition/i,
    scene: 'children playing marimbas, drums and shakers together',
  },
  {
    match: /drama|\bplay|folktale|perform|acting|theatre/i,
    scene: 'children acting out a story on a simple stage with handmade props',
  },
  {
    match: /create in 2d|drawing|painting|pattern|lettering/i,
    scene: 'a table covered in paint, brushes, paper and bright abstract pattern work',
  },
  {
    match: /create in 3d|model|sculpt|relief|clay/i,
    scene: 'hands shaping clay and card models on a craft table',
  },
  {
    match: /career/i,
    scene:
      'a row of people at work in different trades -- a nurse, a builder, a farmer, a teacher',
  },
  {
    match: /\bself\b|identity|emotion|esteem|body image|bullying/i,
    scene: 'a child looking thoughtfully into a mirror, with friends nearby',
  },
  {
    match: /\bright|responsibilit|community|caring/i,
    scene: 'neighbours helping each other in a community garden',
  },
  {
    match: /visual literacy/i,
    scene: "a wall of children's artwork being looked at and discussed",
  },
  {
    match: /halv|doubl/i,
    scene: 'a pile of base-ten blocks being split into two equal piles on a desk',
  },
  {
    match: /large number|million|milliard|billion|trillion/i,
    scene: 'towers of base-ten blocks growing from a single cube to a huge stack',
  },
  {
    match: /even and odd|multiple|factor|divisib/i,
    scene: 'counters on a desk sorted into paired rows and leftover singles',
  },
  {
    match:
      /synonym|antonym|vocabular|noun|pronoun|adjective|adverb|verb|tense|conjunction|sentence structure/i,
    scene:
      'a classroom word wall of blank coloured cards pinned in neat rows, with no writing on them',
  },
  {
    match: /main idea|summaris|summariz|comprehen/i,
    scene:
      'a child highlighting a passage in an open book of blank pages, with a short list of blank cards beside it',
  },
  {
    match: /figurative|simile|metaphor|persuasi|fact versus opinion|formal|informal/i,
    scene: 'two children in conversation with imaginative shapes drifting between them',
  },
  {
    match: /mental (calculation|math)|ratio|rate/i,
    scene: 'a child at a desk with counters and a balance scale, thinking',
  },
  {
    match: /physical feature|mining|mineral/i,
    scene:
      'a South African landscape of mountains, plateau and coast with a mine headgear in the distance',
  },
  {
    match: /ancient egypt|explorer/i,
    scene: 'pyramids beside a river, with a sailing ship and desert beyond',
  },
  {
    match: /water in|river|dam/i,
    scene: 'a dam and river feeding farmland, with a tap and water tank in a village',
  },
  {
    match: /communication|medicine|then and now/i,
    scene:
      'a split scene contrasting an old way and a modern way of doing the same thing',
  },
  {
    match: /people who|made a difference|constitution|revolution/i,
    scene: 'a crowd of people of many ages standing together, seen from behind',
  },
  {
    match: /slave|slavery/i,
    scene:
      'a sombre coastal scene at dusk with a distant sailing ship, respectful and non-graphic',
  },
  {
    match: /kingdom|colony|empire/i,
    scene:
      'a historic southern African settlement of round homesteads with cattle and hills beyond',
  },
  {
    match: /biosphere|variation|living things|reproduction/i,
    scene:
      'a lush landscape layered from soil and plants up through animals to birds and sky',
  },
  {
    match: /\bview|sketch|three-dimensional|two-dimensional|tessellation|transformation/i,
    scene: 'wooden blocks on a desk seen from the front, side and above',
  },
  // Afrikaans FAL topic names.
  {
    match: /groete|voorstel|familie/i,
    scene: 'a family greeting each other warmly at a front door',
  },
  {
    match: /kleur|getal/i,
    scene: 'brightly coloured paint pots and counting beads on a desk',
  },
  {
    match: /klaskamer|skool/i,
    scene: 'a cheerful primary school classroom with desks and supplies',
  },
  {
    match: /weer|seisoen/i,
    scene: 'one landscape shown in four weather moods across the seasons',
  },
  {
    match: /winkel|inkopies/i,
    scene: 'a small neighbourhood shop with shelves of groceries',
  },
  {
    match: /\bsin|paragraaf|skryf|lees/i,
    scene: 'a desk with an open notebook of blank pages and pencils',
  },
  {
    match: /werkwoord|naamwoord|meervoud|voorsetsel|vraagwoord/i,
    scene:
      'a bright classroom wall display of colourful abstract shapes and arrows, with no writing',
  },
]

export interface PromptInput {
  topicName: string
  subjectName: string
  gradeNumber: number
  /** Optional extra scene direction from the admin. Advisory only. */
  sceneHint?: string
}

export function buildIllustrationPrompt({
  topicName,
  subjectName,
  gradeNumber,
  sceneHint,
}: PromptInput): string {
  const cleanName = normaliseTopicName(topicName)

  const subjectDirection =
    SUBJECT_DIRECTION.find((entry) => entry.match.test(subjectName))?.direction ?? ''

  // Matched against the raw name as well as the cleaned one: cleaning strips
  // clause numbers that sometimes carry the only usable keyword.
  const scenes = TOPIC_SCENE.filter(
    (entry) => entry.match.test(cleanName) || entry.match.test(topicName),
  )
    .slice(0, 2)
    .map((entry) => entry.scene)

  const gradeWord = GRADE_WORDS[gradeNumber] ?? 'primary school'

  const parts = [
    `A friendly flat-vector illustration for a South African Grade ${gradeWord} classroom, ` +
      `on the theme of "${cleanName}"${subjectName ? ` in ${subjectName}` : ''}.`,
  ]

  if (scenes.length > 0) {
    parts.push(`Depict ${scenes.join('; and ')}.`)
  }
  if (subjectDirection) {
    parts.push(subjectDirection)
  }
  if (sceneHint && sceneHint.trim()) {
    // Advisory, and deliberately placed before the constraints below so the
    // constraints are the last instruction the model reads.
    // Digits are stripped here too -- a reviewer typing "show 3 children"
    // would otherwise put a numeral back into a prompt that must have none.
    const cleanHint = sceneHint
      .trim()
      .slice(0, 300)
      .replace(/\d+/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
    if (cleanHint) parts.push(`Additional direction from the reviewer: ${cleanHint}`)
  }

  parts.push(
    'Style: clean flat vector, soft rounded shapes, a warm and cheerful palette, generous white space, ' +
      'suitable for a child of upper primary school age. Show a diverse South African cast.',
    'STRICT REQUIREMENTS, which override anything above: absolutely no text, letters, numbers, words, ' +
      'digits, labels, signage or writing of any kind anywhere in the image -- a purely visual scene. ' +
      'No realistic photographic human faces. No logos, brands or trademarks. Nothing violent, frightening ' +
      'or unsafe.',
  )

  return parts.join(' ')
}
