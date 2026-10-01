# StudyLegends — Level B subject illustration manifest

**Status: READY FOR CHATGPT IMAGE GENERATION. Nothing here has been
generated, reviewed or added to the product.**

Ten images are specified below. Seven are priority. No artwork exists yet,
and the product renders correctly without it — `src/lib/subjects/subjectArt.ts`
holds a `null` for every subject and `SubjectMark` falls back to the
gradient-and-glyph tile the marketing site already uses. A missing image
is the current good experience, not a broken card.

---

## 1. What is being made, and why ten

The subject list came from the database, not from assumption. Running the
real taxonomy:

| Subject | Slug | Topics | Grades | Priority |
|---|---|---:|---|---|
| Life Skills | `life-skills` | 50 | 4–6 | **Yes** |
| Mathematics | `mathematics` | 48 | 4–7 | **Yes** |
| Creative Arts | `creative-arts` | 33 | 7 | **Yes** |
| Social Sciences | `social-sciences` | 29 | 4–7 | **Yes** |
| Natural Sciences | `natural-sciences` | 22 | 4–7 | **Yes** |
| English Home Language | `english-home-language` | 21 | 4–7 | **Yes** |
| Afrikaans First Additional Language | `afrikaans-first-additional-language` | 21 | 4–7 | **Yes** |
| Economic and Management Sciences | `economic-and-management-sciences` | 0 | — | Later |
| Life Orientation | `life-orientation` | 0 | — | Later |
| Technology | `technology` | 0 | — | Later |

Three notes on where this differs from the usual eight-subject assumption:

- **There is no single "Languages" world.** English Home Language and
  Afrikaans First Additional Language are two separate subjects a learner
  chooses between, and giving them the same artwork would make the subject
  list look duplicated or broken. They get distinct images, and the
  distinction is pedagogically real: a home language is literature,
  composition and close reading; a first additional language is everyday
  communication and building usable vocabulary.
- **Life Skills and Life Orientation both exist** as separate subjects —
  Life Skills carries Grades 4–6, Life Orientation is the Grade 7 subject
  and currently carries no topics.
- **Three subjects have no topics yet.** They are in the taxonomy and will
  get content, so they are specified here to save a second round, but
  generate the seven priority images first.

**Generate seven now. Ten total specified.**

---

## 2. Format, derived from the real containers

`SubjectMark` (`src/components/ui/SubjectMark.tsx`) is the only component
that renders subject artwork, and it renders a square at three sizes:

| Size | CSS | At 2× DPR |
|---|---|---|
| `sm` | 40 × 40 | 80 px |
| `md` | 48 × 48 | 96 px |
| `lg` | 64 × 64 | 128 px |

That drives three decisions, and they are not negotiable if the images are
to work:

**Square, 1:1.** Every container is square. One aspect ratio, no crops.

**Object-led, no human figures.** A child's face at 48 px is a smudge. The
brief asks for memorable visual metaphors *and* for the subject to stay
readable at card size; at these sizes only the second survives if you put
people in. So each image is an arranged still life of that subject's
objects — distinctive, memorable, and legible at 48 px. This is a
deliberate departure from "diverse South African learners appear in the
artwork", and the reason is purely that it would not be visible. People
belong in Level A brand illustration, at hero scale, where they can be
seen; that is a separate request and is not in this manifest.

**Transparent background.** The subject's gradient sits behind the
artwork — `SubjectMark` keeps it there on purpose, so the art and the
existing colour system read as one identity rather than two competing
ones. Export PNG with a real alpha channel, not white.

**Restrained detail.** No element smaller than roughly 1/12 of the frame.
Anything finer disappears at card size and only adds file weight.

**After generation:** convert to WebP with alpha and place under
`public/subject-art/`. Then set the matching `art` field in
`src/lib/subjects/subjectArt.ts` — one subject at a time, as each is
approved. Nothing else changes.

---

## 3. MASTER STUDYLEGENDS STYLE LOCK

This paragraph is reproduced **in full inside every prompt below**, so
each prompt can be copied into ChatGPT on its own, in any order, days
apart, and still produce one coherent collection. Do not replace it with
"use the style above".

> **STUDYLEGENDS STYLE LOCK.** Premium modern editorial illustration for a
> contemporary educational product. Clean vector-leaning forms with soft
> dimensional shading — gently rounded geometry, subtle depth, a light
> tactile quality like matte paper or soft-touch plastic, never glossy and
> never photoreal. Confident flat colour fills with one soft light source
> from the upper left casting short, soft, low-contrast shadows. Crisp
> clean edges, no outlines or inked strokes, no texture noise, no grain,
> no halftone. Three-quarter elevated view, as if looking down at a table
> from slightly above and to the front, consistent across the set.
> Restrained warm palette: deep navy, bright cyan-teal, warm amber-gold,
> soft lilac and off-white, with one accent colour dominant per image.
> Medium colour saturation, never neon and never pastel-washed.
> Composition is a single tight arrangement of objects, centred, with
> generous empty space around it — the arrangement must occupy roughly the
> central 80% of the frame with clear margin on all four sides. Low visual
> density: six to nine objects at most, each large enough to recognise
> instantly at thumbnail size, nothing smaller than about one twelfth of
> the frame. Warm, intelligent, curious and optimistic in feeling —
> grown-up enough for a parent to trust, inviting enough for a
> nine-to-thirteen-year-old. Explicitly NOT: preschool or toy-like, not
> Disney or Pixar, not anime or manga, not generic 3D clipart, not
> corporate stock illustration, not photorealistic, not isometric
> technical drawing, not neon synthwave. MUST NOT CONTAIN: any text,
> letters, words, numbers, digits, equations, labels, captions,
> signatures, watermarks, logos, brand marks, user-interface elements,
> app screens, buttons, or any readable writing of any kind anywhere in
> the image. No human figures, no faces, no hands. No national flags.
> Square 1:1 composition on a fully transparent background — no
> background colour, no backdrop, no ground plane, no drop shadow onto a
> surface; the objects float cleanly on transparency.

**Why no text, stated once:** image models render letters and digits
unreliably. A curriculum product cannot risk a child reading a garbled
word or a wrong number as real content, and a wrong equation in a maths
illustration is worse than no illustration. This is the same rule the
topic-illustration prompt builder already enforces
(`supabase/functions/generate-topic-illustration/prompt.ts`), for the same
reason.

---

## 4. The images

Shared across all ten, stated once rather than repeated per entry:

- **Recommended aspect ratio:** 1:1, generate at 1024 × 1024.
- **Transparent background:** YES, every one.
- **Safe crop area:** principal arrangement inside the central 80% of the
  frame; keep a clear 10% margin on all four sides. The square is never
  cropped by the current containers, but the margin keeps the image safe
  if it is ever used in a circle or a wider banner.
- **Components:** `SubjectMark` (`src/components/ui/SubjectMark.tsx`), via
  `src/lib/subjects/subjectArt.ts`.
- **Routes:** `/app/subjects` (learner subject cards), `/` (marketing
  subject grid), and any future subject hero that adopts `SubjectMark`.

---

### B-01 · Mathematics

- **IMAGE ID:** `B-01-mathematics`
- **SUBJECT:** Mathematics (`mathematics`) — 48 topics, Grades 4–7
- **PURPOSE:** The subject's visual identity wherever Mathematics is listed or opened.
- **FILE PATH:** `public/subject-art/mathematics.webp`
- **ALT-TEXT INTENT:** Decorative. The subject name is always rendered as real text beside it, so the image ships with `alt=""`.
- **VISUAL CONCEPT:** Spatial relationships made physical — solids, a fraction split into parts, and the idea of balance, arranged as classroom apparatus rather than symbols.
- **DOMINANT ACCENT:** bright cyan-teal.

**PROMPT:**

> STUDYLEGENDS STYLE LOCK. Premium modern editorial illustration for a contemporary educational product. Clean vector-leaning forms with soft dimensional shading — gently rounded geometry, subtle depth, a light tactile quality like matte paper or soft-touch plastic, never glossy and never photoreal. Confident flat colour fills with one soft light source from the upper left casting short, soft, low-contrast shadows. Crisp clean edges, no outlines or inked strokes, no texture noise, no grain, no halftone. Three-quarter elevated view, as if looking down at a table from slightly above and to the front. Restrained warm palette: deep navy, bright cyan-teal, warm amber-gold, soft lilac and off-white, with bright cyan-teal dominant. Medium colour saturation, never neon and never pastel-washed. A single tight arrangement of objects, centred, occupying roughly the central 80% of the frame with clear margin on all four sides. Low visual density: six to nine objects at most, each large enough to recognise instantly at thumbnail size, nothing smaller than about one twelfth of the frame. Warm, intelligent, curious and optimistic. Explicitly NOT preschool or toy-like, not Disney or Pixar, not anime, not generic 3D clipart, not corporate stock illustration, not photorealistic, not isometric technical drawing, not neon synthwave. MUST NOT CONTAIN any text, letters, words, numbers, digits, equations, labels, captions, watermarks, logos, user-interface elements or readable writing of any kind. No human figures, no faces, no hands. Square 1:1 on a fully transparent background — no backdrop, no ground plane, no drop shadow onto a surface.
>
> SUBJECT MATTER: a compact arrangement of mathematics apparatus — a smooth cyan cube and a cone resting beside it, a circular disc cleanly divided into three unequal coloured wedges that sit very slightly apart, a small two-pan balance scale tipped a fraction off level, a short stack of flat square tiles in gold and lilac, and two or three plain round counters. Objects grouped so they slightly overlap and read as one silhouette. No rulers with gradation marks, no clock faces, no dice pips, no calculator keys — nothing that would imply numerals.

---

### B-02 · Natural Sciences

- **IMAGE ID:** `B-02-natural-sciences`
- **SUBJECT:** Natural Sciences (`natural-sciences`) — 22 topics, Grades 4–7
- **PURPOSE / FILE PATH:** `public/subject-art/natural-sciences.webp`
- **ALT-TEXT INTENT:** Decorative; `alt=""`.
- **VISUAL CONCEPT:** Observation and investigation — something living, something being measured, something being looked at closely.
- **DOMINANT ACCENT:** soft lilac.

**PROMPT:**

> STUDYLEGENDS STYLE LOCK. Premium modern editorial illustration for a contemporary educational product. Clean vector-leaning forms with soft dimensional shading — gently rounded geometry, subtle depth, a light tactile quality like matte paper or soft-touch plastic, never glossy and never photoreal. Confident flat colour fills with one soft light source from the upper left casting short, soft, low-contrast shadows. Crisp clean edges, no outlines or inked strokes, no texture noise, no grain, no halftone. Three-quarter elevated view, as if looking down at a table from slightly above and to the front. Restrained warm palette: deep navy, bright cyan-teal, warm amber-gold, soft lilac and off-white, with soft lilac dominant. Medium colour saturation, never neon and never pastel-washed. A single tight arrangement of objects, centred, occupying roughly the central 80% of the frame with clear margin on all four sides. Low visual density: six to nine objects at most, each large enough to recognise instantly at thumbnail size, nothing smaller than about one twelfth of the frame. Warm, intelligent, curious and optimistic. Explicitly NOT preschool or toy-like, not Disney or Pixar, not anime, not generic 3D clipart, not corporate stock illustration, not photorealistic, not isometric technical drawing, not neon synthwave. MUST NOT CONTAIN any text, letters, words, numbers, digits, equations, labels, captions, watermarks, logos, user-interface elements or readable writing of any kind. No human figures, no faces, no hands. Square 1:1 on a fully transparent background — no backdrop, no ground plane, no drop shadow onto a surface.
>
> SUBJECT MATTER: a compact science-bench arrangement — a simple microscope seen three-quarter on, a rounded flask holding a band of teal liquid, a shallow dish with a single green seedling and two curved leaves, a smooth river pebble, and one large soft water droplet. A magnifying lens rests against the flask, its glass catching a pale highlight. No scale markings on the flask, no printed dial on the microscope, no periodic-table motifs, no atom-with-orbits cliché, no chemical formulae.

---

### B-03 · Social Sciences

- **IMAGE ID:** `B-03-social-sciences`
- **SUBJECT:** Social Sciences (`social-sciences`) — 29 topics, Grades 4–7
- **PURPOSE / FILE PATH:** `public/subject-art/social-sciences.webp`
- **ALT-TEXT INTENT:** Decorative; `alt=""`.
- **VISUAL CONCEPT:** Place and time — geography and history as objects you handle. South African landscape forms, abstracted.
- **DOMINANT ACCENT:** warm amber-gold.

**PROMPT:**

> STUDYLEGENDS STYLE LOCK. Premium modern editorial illustration for a contemporary educational product. Clean vector-leaning forms with soft dimensional shading — gently rounded geometry, subtle depth, a light tactile quality like matte paper or soft-touch plastic, never glossy and never photoreal. Confident flat colour fills with one soft light source from the upper left casting short, soft, low-contrast shadows. Crisp clean edges, no outlines or inked strokes, no texture noise, no grain, no halftone. Three-quarter elevated view, as if looking down at a table from slightly above and to the front. Restrained warm palette: deep navy, bright cyan-teal, warm amber-gold, soft lilac and off-white, with warm amber-gold dominant. Medium colour saturation, never neon and never pastel-washed. A single tight arrangement of objects, centred, occupying roughly the central 80% of the frame with clear margin on all four sides. Low visual density: six to nine objects at most, each large enough to recognise instantly at thumbnail size, nothing smaller than about one twelfth of the frame. Warm, intelligent, curious and optimistic. Explicitly NOT preschool or toy-like, not Disney or Pixar, not anime, not generic 3D clipart, not corporate stock illustration, not photorealistic, not isometric technical drawing, not neon synthwave. MUST NOT CONTAIN any text, letters, words, numbers, digits, equations, labels, captions, watermarks, logos, user-interface elements or readable writing of any kind. No human figures, no faces, no hands. No national flags. Square 1:1 on a fully transparent background — no backdrop, no ground plane, no drop shadow onto a surface.
>
> SUBJECT MATTER: a compact arrangement of geography and history objects — a partly unrolled map sheet whose surface shows only abstract coloured landmasses, rivers and contour bands with absolutely no place names or grid labels, a brass compass with a plain needle and no lettered points, a small flat-topped mountain form in warm ochre suggesting a highveld plateau, a weathered clay pot, and a single rounded acacia-like tree. A small stack of closed books lies flat beneath the map, spines plain and unlettered.

---

### B-04 · English Home Language

- **IMAGE ID:** `B-04-english-home-language`
- **SUBJECT:** English Home Language (`english-home-language`) — 21 topics, Grades 4–7
- **PURPOSE / FILE PATH:** `public/subject-art/english-home-language.webp`
- **ALT-TEXT INTENT:** Decorative; `alt=""`.
- **VISUAL CONCEPT:** Reading and composition — the literature-and-writing half of language. Distinct from B-05 by being about the page.
- **DOMINANT ACCENT:** bright cyan-teal into soft lilac.

**PROMPT:**

> STUDYLEGENDS STYLE LOCK. Premium modern editorial illustration for a contemporary educational product. Clean vector-leaning forms with soft dimensional shading — gently rounded geometry, subtle depth, a light tactile quality like matte paper or soft-touch plastic, never glossy and never photoreal. Confident flat colour fills with one soft light source from the upper left casting short, soft, low-contrast shadows. Crisp clean edges, no outlines or inked strokes, no texture noise, no grain, no halftone. Three-quarter elevated view, as if looking down at a table from slightly above and to the front. Restrained warm palette: deep navy, bright cyan-teal, warm amber-gold, soft lilac and off-white, with bright cyan-teal shading into soft lilac dominant. Medium colour saturation, never neon and never pastel-washed. A single tight arrangement of objects, centred, occupying roughly the central 80% of the frame with clear margin on all four sides. Low visual density: six to nine objects at most, each large enough to recognise instantly at thumbnail size, nothing smaller than about one twelfth of the frame. Warm, intelligent, curious and optimistic. Explicitly NOT preschool or toy-like, not Disney or Pixar, not anime, not generic 3D clipart, not corporate stock illustration, not photorealistic, not isometric technical drawing, not neon synthwave. MUST NOT CONTAIN any text, letters, words, numbers, digits, equations, labels, captions, watermarks, logos, user-interface elements or readable writing of any kind. No human figures, no faces, no hands. Square 1:1 on a fully transparent background — no backdrop, no ground plane, no drop shadow onto a surface.
>
> SUBJECT MATTER: a compact arrangement about reading and writing — one large book lying open with both pages completely blank and softly curved, a second and third closed book stacked beneath it with plain unlettered spines, a fountain pen resting diagonally across the open page, a folded sheet of paper, and a single bookmark ribbon. Above the open book, two or three small simple leaf or feather shapes drift upward to suggest imagination rising off the page. Absolutely no writing, no ruled lines, no printed text on any page.

---

### B-05 · Afrikaans First Additional Language

- **IMAGE ID:** `B-05-afrikaans-first-additional-language`
- **SUBJECT:** Afrikaans First Additional Language (`afrikaans-first-additional-language`) — 21 topics, Grades 4–7
- **PURPOSE / FILE PATH:** `public/subject-art/afrikaans-first-additional-language.webp`
- **ALT-TEXT INTENT:** Decorative; `alt=""`.
- **VISUAL CONCEPT:** Everyday spoken communication — the practical, conversational half of language. Deliberately readable as a different world from B-04 at a glance.
- **DOMINANT ACCENT:** soft lilac into bright cyan-teal.

**PROMPT:**

> STUDYLEGENDS STYLE LOCK. Premium modern editorial illustration for a contemporary educational product. Clean vector-leaning forms with soft dimensional shading — gently rounded geometry, subtle depth, a light tactile quality like matte paper or soft-touch plastic, never glossy and never photoreal. Confident flat colour fills with one soft light source from the upper left casting short, soft, low-contrast shadows. Crisp clean edges, no outlines or inked strokes, no texture noise, no grain, no halftone. Three-quarter elevated view, as if looking down at a table from slightly above and to the front. Restrained warm palette: deep navy, bright cyan-teal, warm amber-gold, soft lilac and off-white, with soft lilac shading into bright cyan-teal dominant. Medium colour saturation, never neon and never pastel-washed. A single tight arrangement of objects, centred, occupying roughly the central 80% of the frame with clear margin on all four sides. Low visual density: six to nine objects at most, each large enough to recognise instantly at thumbnail size, nothing smaller than about one twelfth of the frame. Warm, intelligent, curious and optimistic. Explicitly NOT preschool or toy-like, not Disney or Pixar, not anime, not generic 3D clipart, not corporate stock illustration, not photorealistic, not isometric technical drawing, not neon synthwave. MUST NOT CONTAIN any text, letters, words, numbers, digits, equations, labels, captions, watermarks, logos, user-interface elements or readable writing of any kind. No human figures, no faces, no hands. Square 1:1 on a fully transparent background — no backdrop, no ground plane, no drop shadow onto a surface.
>
> SUBJECT MATTER: a compact arrangement about everyday conversation — two large rounded speech bubbles of different sizes overlapping at an angle, both completely empty inside with no writing or dots, rendered as solid soft-shaded objects with real thickness rather than flat outlines. Beside them a small stack of blank flash cards fanned slightly, a pair of simple over-ear headphones, and one small open notebook with entirely blank pages. Keep the composition clearly distinct from a book-and-pen still life; the speech bubbles must be the dominant forms.

---

### B-06 · Life Skills

- **IMAGE ID:** `B-06-life-skills`
- **SUBJECT:** Life Skills (`life-skills`) — 50 topics, Grades 4–6
- **PURPOSE / FILE PATH:** `public/subject-art/life-skills.webp`
- **ALT-TEXT INTENT:** Decorative; `alt=""`.
- **VISUAL CONCEPT:** Growth, wellbeing and everyday capability — health, movement and care, as the objects of a daily routine.
- **DOMINANT ACCENT:** warm amber-gold into coral.

**PROMPT:**

> STUDYLEGENDS STYLE LOCK. Premium modern editorial illustration for a contemporary educational product. Clean vector-leaning forms with soft dimensional shading — gently rounded geometry, subtle depth, a light tactile quality like matte paper or soft-touch plastic, never glossy and never photoreal. Confident flat colour fills with one soft light source from the upper left casting short, soft, low-contrast shadows. Crisp clean edges, no outlines or inked strokes, no texture noise, no grain, no halftone. Three-quarter elevated view, as if looking down at a table from slightly above and to the front. Restrained warm palette: deep navy, bright cyan-teal, warm amber-gold, soft lilac and off-white, with warm amber-gold shading into soft coral dominant. Medium colour saturation, never neon and never pastel-washed. A single tight arrangement of objects, centred, occupying roughly the central 80% of the frame with clear margin on all four sides. Low visual density: six to nine objects at most, each large enough to recognise instantly at thumbnail size, nothing smaller than about one twelfth of the frame. Warm, intelligent, curious and optimistic. Explicitly NOT preschool or toy-like, not Disney or Pixar, not anime, not generic 3D clipart, not corporate stock illustration, not photorealistic, not isometric technical drawing, not neon synthwave. MUST NOT CONTAIN any text, letters, words, numbers, digits, equations, labels, captions, watermarks, logos, user-interface elements or readable writing of any kind. No human figures, no faces, no hands. Square 1:1 on a fully transparent background — no backdrop, no ground plane, no drop shadow onto a surface.
>
> SUBJECT MATTER: a compact arrangement about healthy everyday life — a reusable water bottle standing upright, a round apple and a bunch of three grapes, a skipping rope coiled into a loose spiral, a small potted plant with two broad leaves, and a folded towel. A single soft heart shape sits low in the arrangement, simple and geometric rather than cartoon. No medical cross, no first-aid symbols, no bandages, no fitness-tracker screens.

---

### B-07 · Creative Arts

- **IMAGE ID:** `B-07-creative-arts`
- **SUBJECT:** Creative Arts (`creative-arts`) — 33 topics, Grade 7
- **PURPOSE / FILE PATH:** `public/subject-art/creative-arts.webp`
- **ALT-TEXT INTENT:** Decorative; `alt=""`.
- **VISUAL CONCEPT:** Making and performing — visual art, music and drama held together in one arrangement.
- **DOMINANT ACCENT:** soft coral into lilac.

**PROMPT:**

> STUDYLEGENDS STYLE LOCK. Premium modern editorial illustration for a contemporary educational product. Clean vector-leaning forms with soft dimensional shading — gently rounded geometry, subtle depth, a light tactile quality like matte paper or soft-touch plastic, never glossy and never photoreal. Confident flat colour fills with one soft light source from the upper left casting short, soft, low-contrast shadows. Crisp clean edges, no outlines or inked strokes, no texture noise, no grain, no halftone. Three-quarter elevated view, as if looking down at a table from slightly above and to the front. Restrained warm palette: deep navy, bright cyan-teal, warm amber-gold, soft lilac and off-white, with soft coral shading into lilac dominant. Medium colour saturation, never neon and never pastel-washed. A single tight arrangement of objects, centred, occupying roughly the central 80% of the frame with clear margin on all four sides. Low visual density: six to nine objects at most, each large enough to recognise instantly at thumbnail size, nothing smaller than about one twelfth of the frame. Warm, intelligent, curious and optimistic. Explicitly NOT preschool or toy-like, not Disney or Pixar, not anime, not generic 3D clipart, not corporate stock illustration, not photorealistic, not isometric technical drawing, not neon synthwave. MUST NOT CONTAIN any text, letters, words, numbers, digits, equations, labels, captions, watermarks, logos, user-interface elements or readable writing of any kind. No musical notation, no staves, no clefs, no note symbols. No human figures, no faces, no hands. Square 1:1 on a fully transparent background — no backdrop, no ground plane, no drop shadow onto a surface.
>
> SUBJECT MATTER: a compact arrangement of art and performance objects — a small hand drum seen three-quarter on, two wooden mallets crossed beside it, a shallow palette holding four rounded blobs of coral, gold, teal and lilac paint, two paintbrushes with paint on the bristles, a shaker rattle, and a single theatre spotlight tilted downward with a soft cone of warm light. Keep the drum and the palette as the two dominant forms so the subject reads instantly.

---

### B-08 · Economic and Management Sciences *(no topics yet — generate later)*

- **IMAGE ID:** `B-08-economic-and-management-sciences`
- **SUBJECT:** Economic and Management Sciences (`economic-and-management-sciences`) — 0 topics
- **PURPOSE / FILE PATH:** `public/subject-art/economic-and-management-sciences.webp`
- **ALT-TEXT INTENT:** Decorative; `alt=""`.
- **VISUAL CONCEPT:** Exchange and enterprise — a market stall's worth of objects, money shown as plain coins without denominations.
- **DOMINANT ACCENT:** warm amber-gold.

**PROMPT:**

> STUDYLEGENDS STYLE LOCK. Premium modern editorial illustration for a contemporary educational product. Clean vector-leaning forms with soft dimensional shading — gently rounded geometry, subtle depth, a light tactile quality like matte paper or soft-touch plastic, never glossy and never photoreal. Confident flat colour fills with one soft light source from the upper left casting short, soft, low-contrast shadows. Crisp clean edges, no outlines or inked strokes, no texture noise, no grain, no halftone. Three-quarter elevated view, as if looking down at a table from slightly above and to the front. Restrained warm palette: deep navy, bright cyan-teal, warm amber-gold, soft lilac and off-white, with warm amber-gold dominant. Medium colour saturation, never neon and never pastel-washed. A single tight arrangement of objects, centred, occupying roughly the central 80% of the frame with clear margin on all four sides. Low visual density: six to nine objects at most, each large enough to recognise instantly at thumbnail size, nothing smaller than about one twelfth of the frame. Warm, intelligent, curious and optimistic. Explicitly NOT preschool or toy-like, not Disney or Pixar, not anime, not generic 3D clipart, not corporate stock illustration, not photorealistic, not isometric technical drawing, not neon synthwave. MUST NOT CONTAIN any text, letters, words, numbers, digits, equations, currency symbols, labels, captions, watermarks, logos, user-interface elements or readable writing of any kind. No banknotes. No human figures, no faces, no hands. Square 1:1 on a fully transparent background — no backdrop, no ground plane, no drop shadow onto a surface.
>
> SUBJECT MATTER: a compact market-and-enterprise arrangement — a small striped market-stall awning seen three-quarter on, a woven basket holding three rounded fruit, a short stack of plain gold discs standing in for coins with completely blank faces, a simple money tin, and a small set of hanging scales. Keep the awning and the basket dominant so the idea reads as trade rather than banking.

---

### B-09 · Life Orientation *(no topics yet — generate later)*

- **IMAGE ID:** `B-09-life-orientation`
- **SUBJECT:** Life Orientation (`life-orientation`) — 0 topics
- **PURPOSE / FILE PATH:** `public/subject-art/life-orientation.webp`
- **ALT-TEXT INTENT:** Decorative; `alt=""`.
- **VISUAL CONCEPT:** Direction and self — the Grade 7 subject about choices and personal development. Must not duplicate Life Skills (B-06); this one is about navigating forward rather than daily wellbeing.
- **DOMINANT ACCENT:** soft coral into amber-gold.

**PROMPT:**

> STUDYLEGENDS STYLE LOCK. Premium modern editorial illustration for a contemporary educational product. Clean vector-leaning forms with soft dimensional shading — gently rounded geometry, subtle depth, a light tactile quality like matte paper or soft-touch plastic, never glossy and never photoreal. Confident flat colour fills with one soft light source from the upper left casting short, soft, low-contrast shadows. Crisp clean edges, no outlines or inked strokes, no texture noise, no grain, no halftone. Three-quarter elevated view, as if looking down at a table from slightly above and to the front. Restrained warm palette: deep navy, bright cyan-teal, warm amber-gold, soft lilac and off-white, with soft coral shading into amber-gold dominant. Medium colour saturation, never neon and never pastel-washed. A single tight arrangement of objects, centred, occupying roughly the central 80% of the frame with clear margin on all four sides. Low visual density: six to nine objects at most, each large enough to recognise instantly at thumbnail size, nothing smaller than about one twelfth of the frame. Warm, intelligent, curious and optimistic. Explicitly NOT preschool or toy-like, not Disney or Pixar, not anime, not generic 3D clipart, not corporate stock illustration, not photorealistic, not isometric technical drawing, not neon synthwave. MUST NOT CONTAIN any text, letters, words, numbers, digits, equations, labels, captions, watermarks, logos, user-interface elements or readable writing of any kind. No human figures, no faces, no hands. Square 1:1 on a fully transparent background — no backdrop, no ground plane, no drop shadow onto a surface.
>
> SUBJECT MATTER: a compact arrangement about direction and growth — a signpost with three blank arrow boards pointing different ways and no writing on any of them, a round hand compass, a small sapling in a pot with a single upward shoot, a folded road map with only abstract coloured routes and no place names, and one smooth round stepping stone. Keep the signpost dominant so the idea reads as choosing a direction, clearly different from a wellbeing still life.

---

### B-10 · Technology *(no topics yet — generate later)*

- **IMAGE ID:** `B-10-technology`
- **SUBJECT:** Technology (`technology`) — 0 topics
- **PURPOSE / FILE PATH:** `public/subject-art/technology.webp`
- **ALT-TEXT INTENT:** Decorative; `alt=""`.
- **VISUAL CONCEPT:** Designing and building — structures and mechanisms, the making side rather than the computing side.
- **DOMINANT ACCENT:** bright cyan-teal into deep navy.

**PROMPT:**

> STUDYLEGENDS STYLE LOCK. Premium modern editorial illustration for a contemporary educational product. Clean vector-leaning forms with soft dimensional shading — gently rounded geometry, subtle depth, a light tactile quality like matte paper or soft-touch plastic, never glossy and never photoreal. Confident flat colour fills with one soft light source from the upper left casting short, soft, low-contrast shadows. Crisp clean edges, no outlines or inked strokes, no texture noise, no grain, no halftone. Three-quarter elevated view, as if looking down at a table from slightly above and to the front. Restrained warm palette: deep navy, bright cyan-teal, warm amber-gold, soft lilac and off-white, with bright cyan-teal shading into deep navy dominant. Medium colour saturation, never neon and never pastel-washed. A single tight arrangement of objects, centred, occupying roughly the central 80% of the frame with clear margin on all four sides. Low visual density: six to nine objects at most, each large enough to recognise instantly at thumbnail size, nothing smaller than about one twelfth of the frame. Warm, intelligent, curious and optimistic. Explicitly NOT preschool or toy-like, not Disney or Pixar, not anime, not generic 3D clipart, not corporate stock illustration, not photorealistic, not isometric technical drawing, not neon synthwave. MUST NOT CONTAIN any text, letters, words, numbers, digits, equations, labels, captions, dimension lines, measurement marks, watermarks, logos, user-interface elements, app screens or readable writing of any kind. No human figures, no faces, no hands. Square 1:1 on a fully transparent background — no backdrop, no ground plane, no drop shadow onto a surface.
>
> SUBJECT MATTER: a compact design-and-build arrangement — a small bridge truss made of rounded beams, two interlocking gears of different sizes, a loosely rolled sheet of plan paper showing only plain blank surface with no drawing or dimensions on it, a pair of dividers, and a single large bolt. Keep the truss and the gears dominant so the subject reads as making and mechanism rather than computing.

---

## 5. Adding an approved image

1. Convert the reviewed PNG to WebP preserving alpha, around 512 × 512 is
   ample for a 128 px container at 2× DPR. Keep it under about 40 KB.
2. Save it to `public/subject-art/<slug>.webp`.
3. In `src/lib/subjects/subjectArt.ts`, set that subject's `art` to
   `{ src: '/subject-art/<slug>.webp', focal: 'center' }`.
4. Nothing else. `SubjectMark` picks it up everywhere at once, with the
   subject's gradient still behind it.

Subjects you have not reached yet keep rendering their gradient and glyph,
so the set can be adopted one image at a time with no broken intermediate
state.
