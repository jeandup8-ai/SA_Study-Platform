/**
 * Structural validation for artwork entering the Level C pipeline.
 *
 * Everything here works on raw bytes and nothing else. That is deliberate
 * in two ways.
 *
 * First, a browser's `File` tells you a `type` and a `name`, and both come
 * from the client. A file called `cat.webp` reporting `image/webp` can be
 * anything at all. So the format is read out of the magic bytes and the
 * dimensions out of the container header, and the reported MIME type is
 * only ever used to produce a clearer error message -- never to decide
 * anything.
 *
 * Second, byte-level rules run identically in the browser and in Node,
 * which is what lets scripts/check-artwork-validation.mjs exercise every
 * rule against deliberately malformed fixtures. A rule that can only run
 * inside a file picker is a rule nobody ever tests.
 *
 * What this cannot do is judge the picture. "A square, opaque, 1024px
 * WebP that decodes" is not "a person looked at this and decided it
 * teaches the topic". That decision stays where it already lives: a human
 * pressing Approve in the Illustration Studio, which is the only thing
 * that moves approval_status and therefore the only thing that can make an
 * image reach a learner.
 */

export type ImageFormat = 'webp' | 'png' | 'jpeg'

export interface ImageHeader {
  format: ImageFormat
  width: number
  height: number
  /**
   * Whether the container declares an alpha channel. False is a hard
   * guarantee of opacity; true only means transparency is *possible*, so
   * the caller still samples real pixels before rejecting on it.
   */
  mayHaveAlpha: boolean
}

export interface Finding {
  /** Stable identifier, so the check script can assert on rules by name. */
  rule: string
  message: string
}

export interface ValidationResult {
  ok: boolean
  /** Null when the bytes could not be identified at all. */
  header: ImageHeader | null
  /** Blocking. The upload does not proceed while any of these are present. */
  errors: Finding[]
  /** Worth seeing before uploading, but not blocking. */
  warnings: Finding[]
}

// ---------------------------------------------------------------------------
// Level C limits
//
// Chosen against what the pipeline already holds rather than invented. The
// 151 existing images are 1024x1024 PNGs between 1.17MB and 1.66MB, so the
// 8MB ceiling is a real bound on a mistake (a camera photo, a PSD export)
// without being anywhere near what correct artwork weighs.
// ---------------------------------------------------------------------------

/** What the generator produces and what the manifest asks ChatGPT for. */
export const LEVEL_C_TARGET_EDGE = 1024
/** Below this the lesson visual step shows a soft, upscaled picture. */
export const LEVEL_C_MIN_EDGE = 512
/** Above this is a mistake, not a choice -- nothing renders larger. */
export const LEVEL_C_MAX_EDGE = 2048
export const LEVEL_C_MAX_BYTES = 8 * 1024 * 1024
/** Comfortably above the heaviest existing asset (1.66MB). */
export const LEVEL_C_SOFT_MAX_BYTES = 3 * 1024 * 1024
/**
 * Level C renders full-bleed inside a rounded card. Transparent pixels show
 * the card through the picture, so the artwork must be opaque. A handful of
 * not-quite-255 pixels along an anti-aliased edge is normal; a transparent
 * background is not, and the difference is a matter of proportion.
 */
export const LEVEL_C_MAX_TRANSPARENT_FRACTION = 0.005
/** Below this an alpha value counts as "see-through", not anti-aliasing. */
export const OPAQUE_ALPHA_THRESHOLD = 250

const FORMAT_MIME: Record<ImageFormat, string> = {
  webp: 'image/webp',
  png: 'image/png',
  jpeg: 'image/jpeg',
}

const FORMAT_EXTENSION: Record<ImageFormat, string> = {
  webp: 'webp',
  png: 'png',
  jpeg: 'jpg',
}

/** The canonical MIME type for a format we actually identified in the bytes. */
export function mimeTypeFor(format: ImageFormat): string {
  return FORMAT_MIME[format]
}

/** The file extension for a format we actually identified in the bytes. */
export function extensionFor(format: ImageFormat): string {
  return FORMAT_EXTENSION[format]
}

function u16be(bytes: Uint8Array, at: number): number {
  return (bytes[at] << 8) | bytes[at + 1]
}

function u32be(bytes: Uint8Array, at: number): number {
  return (
    ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>>
    0
  )
}

function ascii(bytes: Uint8Array, from: number, to: number): string {
  let out = ''
  for (let i = from; i < to && i < bytes.length; i++) out += String.fromCharCode(bytes[i])
  return out
}

/**
 * Identifies the format from magic bytes alone.
 *
 * The client-reported MIME type is not consulted, because it is a string
 * the browser took from the operating system and the operating system took
 * from the file extension.
 */
export function sniffImageFormat(bytes: Uint8Array): ImageFormat | null {
  if (
    bytes.length >= 12 &&
    ascii(bytes, 0, 4) === 'RIFF' &&
    ascii(bytes, 8, 12) === 'WEBP'
  ) {
    return 'webp'
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'png'
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg'
  }
  return null
}

function readWebpHeader(bytes: Uint8Array): ImageHeader | null {
  // The RIFF size field counts everything after the first 8 bytes. A file
  // that claims more than it carries was truncated in transit or in an
  // export, and will decode to a grey band or not at all.
  if (bytes.length < 16) return null
  const declared = bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24)
  if (declared + 8 > bytes.length) return null

  const fourcc = ascii(bytes, 12, 16)

  if (fourcc === 'VP8X') {
    if (bytes.length < 30) return null
    const flags = bytes[20]
    const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16))
    const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16))
    return { format: 'webp', width, height, mayHaveAlpha: Boolean(flags & 0x10) }
  }

  if (fourcc === 'VP8L') {
    if (bytes.length < 26) return null
    // 0x2f signature, then 14 bits width-1, 14 bits height-1, then the
    // alpha_is_used hint at bit 28.
    if (bytes[20] !== 0x2f) return null
    const bits =
      (bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24)) >>> 0
    return {
      format: 'webp',
      width: (bits & 0x3fff) + 1,
      height: ((bits >>> 14) & 0x3fff) + 1,
      mayHaveAlpha: Boolean((bits >>> 28) & 1),
    }
  }

  if (fourcc === 'VP8 ') {
    if (bytes.length < 30) return null
    // Simple lossy. The 3-byte start code 0x9d 0x01 0x2a precedes the
    // dimensions, and this variant cannot carry alpha at all.
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null
    const width = (bytes[26] | (bytes[27] << 8)) & 0x3fff
    const height = (bytes[28] | (bytes[29] << 8)) & 0x3fff
    return { format: 'webp', width, height, mayHaveAlpha: false }
  }

  return null
}

function readPngHeader(bytes: Uint8Array): ImageHeader | null {
  // IHDR is mandatory and must be the first chunk.
  if (bytes.length < 33) return null
  if (ascii(bytes, 12, 16) !== 'IHDR') return null
  const width = u32be(bytes, 16)
  const height = u32be(bytes, 20)
  const colourType = bytes[25]
  if (width === 0 || height === 0) return null
  // Colour types 4 (grey+alpha) and 6 (RGBA) carry a real alpha channel; a
  // tRNS chunk can add transparency to the others.
  const hasAlphaChannel = colourType === 4 || colourType === 6
  const hasTrns = findPngChunk(bytes, 'tRNS')
  return { format: 'png', width, height, mayHaveAlpha: hasAlphaChannel || hasTrns }
}

function findPngChunk(bytes: Uint8Array, name: string): boolean {
  let at = 8
  while (at + 8 <= bytes.length) {
    const length = u32be(bytes, at)
    const type = ascii(bytes, at + 4, at + 8)
    if (type === name) return true
    if (type === 'IDAT' || type === 'IEND') return false
    // 4 length + 4 type + payload + 4 CRC
    const next = at + 12 + length
    if (next <= at) return false
    at = next
  }
  return false
}

function readJpegHeader(bytes: Uint8Array): ImageHeader | null {
  // Walk the marker segments to the start-of-frame, which is the only place
  // the dimensions live. JPEG has no alpha channel in any variant.
  let at = 2
  while (at + 4 <= bytes.length) {
    if (bytes[at] !== 0xff) return null
    const marker = bytes[at + 1]
    // Standalone markers carry no length field.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      at += 2
      continue
    }
    const length = u16be(bytes, at + 2)
    if (length < 2) return null
    const isStartOfFrame =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc
    if (isStartOfFrame) {
      if (at + 9 > bytes.length) return null
      return {
        format: 'jpeg',
        height: u16be(bytes, at + 5),
        width: u16be(bytes, at + 7),
        mayHaveAlpha: false,
      }
    }
    at += 2 + length
  }
  return null
}

/**
 * Reads format and dimensions out of the container header.
 *
 * Returns null for anything that is not one of the three supported formats,
 * or whose header is malformed or truncated. It never guesses: a header it
 * cannot parse is reported as unreadable rather than defaulted.
 */
export function readImageHeader(bytes: Uint8Array): ImageHeader | null {
  const format = sniffImageFormat(bytes)
  if (format === 'webp') return readWebpHeader(bytes)
  if (format === 'png') return readPngHeader(bytes)
  if (format === 'jpeg') return readJpegHeader(bytes)
  return null
}

export interface LevelCInput {
  /** The client-reported filename. Used for messages only, never for identity. */
  fileName: string
  /** The client-reported MIME type. Used for messages only, never trusted. */
  declaredMimeType: string
  bytes: Uint8Array
  /**
   * The fraction of sampled pixels whose alpha is below
   * OPAQUE_ALPHA_THRESHOLD, measured by decoding the image. Omitted when the
   * caller could not decode it; the header's alpha flag is then the only
   * evidence available and a possible alpha channel becomes a warning rather
   * than an error, because a declared channel that is fully opaque is
   * perfectly common.
   */
  transparentFraction?: number
  /**
   * Whether a real image decoder accepted the bytes. The header parser only
   * reads the first few dozen bytes, so it cannot see a file truncated
   * halfway through its pixel data.
   */
  decoded?: boolean
}

/**
 * Applies every structural rule for a Level C topic illustration.
 *
 * Errors block the upload. Warnings are shown and the admin may proceed --
 * they describe artwork that will work but is not what the manifest asked
 * for, which is a judgement call rather than a defect.
 */
export function validateLevelCUpload(input: LevelCInput): ValidationResult {
  const errors: Finding[] = []
  const warnings: Finding[] = []
  const { bytes, fileName, declaredMimeType } = input

  if (bytes.length === 0) {
    return {
      ok: false,
      header: null,
      errors: [{ rule: 'empty', message: `${fileName} is empty (0 bytes).` }],
      warnings,
    }
  }

  if (bytes.length > LEVEL_C_MAX_BYTES) {
    errors.push({
      rule: 'max-bytes',
      message:
        `${fileName} is ${formatBytes(bytes.length)}, over the ` +
        `${formatBytes(LEVEL_C_MAX_BYTES)} limit. The existing illustrations are all ` +
        `under 2MB, so this is very likely a photo or an unflattened export.`,
    })
  }

  const format = sniffImageFormat(bytes)
  if (!format) {
    errors.push({
      rule: 'unsupported-format',
      message:
        `${fileName} is not a WebP, PNG or JPEG. Its first bytes match no supported ` +
        `image format` +
        (declaredMimeType
          ? `, whatever it reports itself as (${declaredMimeType}).`
          : '.'),
    })
    return { ok: false, header: null, errors, warnings }
  }

  // Reported type disagreeing with the real bytes is not itself a failure --
  // the real bytes are what gets stored and what the content type is derived
  // from -- but it is worth saying, because it usually means a file was
  // renamed rather than re-exported.
  const expectedMime = FORMAT_MIME[format]
  if (declaredMimeType && declaredMimeType !== expectedMime) {
    warnings.push({
      rule: 'mime-mismatch',
      message:
        `${fileName} reports itself as ${declaredMimeType} but its bytes are ${format.toUpperCase()}. ` +
        `The real format is what will be stored.`,
    })
  }

  const header = readImageHeader(bytes)
  if (!header) {
    errors.push({
      rule: 'corrupt-header',
      message:
        `${fileName} looks like a ${format.toUpperCase()} but its header could not be read. ` +
        `It is most likely truncated or corrupt.`,
    })
    return { ok: false, header: null, errors, warnings }
  }

  if (input.decoded === false) {
    errors.push({
      rule: 'undecodable',
      message:
        `${fileName} has a readable header but the browser could not decode it. ` +
        `A file that fails to decode here will fail to render in a lesson.`,
    })
  }

  if (header.width !== header.height) {
    errors.push({
      rule: 'not-square',
      message:
        `${fileName} is ${header.width}x${header.height}. Topic illustrations render ` +
        `in a square card, so a non-square image would be cropped and the crop would ` +
        `not be reviewed.`,
    })
  }

  if (header.width < LEVEL_C_MIN_EDGE || header.height < LEVEL_C_MIN_EDGE) {
    errors.push({
      rule: 'too-small',
      message:
        `${fileName} is ${header.width}x${header.height}, below the ${LEVEL_C_MIN_EDGE}px ` +
        `minimum. It would be upscaled in the lesson visual step.`,
    })
  } else if (header.width > LEVEL_C_MAX_EDGE || header.height > LEVEL_C_MAX_EDGE) {
    errors.push({
      rule: 'too-large',
      message:
        `${fileName} is ${header.width}x${header.height}, above the ${LEVEL_C_MAX_EDGE}px ` +
        `maximum. Nothing in the product renders larger than ${LEVEL_C_TARGET_EDGE}px.`,
    })
  } else if (header.width !== LEVEL_C_TARGET_EDGE) {
    warnings.push({
      rule: 'off-target-size',
      message:
        `${fileName} is ${header.width}x${header.height}. The manifest asks for ` +
        `${LEVEL_C_TARGET_EDGE}x${LEVEL_C_TARGET_EDGE}, which is what every existing ` +
        `illustration is.`,
    })
  }

  if (format !== 'webp') {
    warnings.push({
      rule: 'format-not-preferred',
      message:
        `${fileName} is ${format.toUpperCase()}. WebP is preferred for new artwork — it is ` +
        `typically a third of the size at the same quality. PNG is what the existing ` +
        `pipeline produces, so it is accepted.`,
    })
  }

  // Opacity. The header's alpha flag is necessary but not sufficient: a PNG
  // exported as RGBA with every pixel opaque declares a channel it does not
  // use, and rejecting that would reject most correct exports.
  if (typeof input.transparentFraction === 'number') {
    if (input.transparentFraction > LEVEL_C_MAX_TRANSPARENT_FRACTION) {
      errors.push({
        rule: 'not-opaque',
        message:
          `${fileName} is ${(input.transparentFraction * 100).toFixed(1)}% transparent. ` +
          `Topic illustrations sit full-bleed inside a card, so transparency shows the ` +
          `card through the picture. Re-export on an opaque background. (Transparency is ` +
          `required for Level B subject marks and forbidden here — they are different assets.)`,
      })
    }
  } else if (header.mayHaveAlpha) {
    warnings.push({
      rule: 'alpha-unverified',
      message:
        `${fileName} declares an alpha channel and could not be sampled here, so whether ` +
        `it is actually opaque is unverified. Check it in the review dialog before approving.`,
    })
  }

  return { ok: errors.length === 0, header, errors, warnings }
}

function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)}MB`
  return `${Math.round(n / 1024)}KB`
}

// ---------------------------------------------------------------------------
// Storage paths
// ---------------------------------------------------------------------------

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Whether a string is a well-formed UUID. The only identity we build paths from. */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

/**
 * Builds the storage key for a topic illustration.
 *
 * Every component is derived from something trusted: the topic's UUID as it
 * came back from the database, a clock reading, and a format read out of the
 * file's own magic bytes. The uploaded filename contributes nothing, so
 * `../../`, a null byte, a leading slash or a 300-character name cannot
 * reach the path -- and the UUID assertion means even a caller that passed
 * an attacker-chosen `topicId` string gets an exception rather than a
 * traversal.
 *
 * This matches the layout the generator already writes
 * (`<topic-uuid>/<epoch-ms>.png`), so uploaded and generated assets sit side
 * by side under the same prefix instead of forming a second convention.
 */
export function topicArtworkStoragePath(
  topicId: string,
  format: ImageFormat,
  now: number = Date.now(),
): string {
  if (!isUuid(topicId)) {
    throw new Error(
      `refusing to build a storage path from a non-UUID topic id: ${topicId}`,
    )
  }
  return `${topicId}/${now}.${FORMAT_EXTENSION[format]}`
}

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

/**
 * Provider and source values for artwork a human generated elsewhere and
 * uploaded.
 *
 * Kept deliberately distinct from the generator's `provider: 'openai'` /
 * `source: 'ai_generated:gpt-image-1'`. Writing those for an upload would
 * claim this project's API produced an image it never saw, which would make
 * the 151 existing rows and any future upload indistinguishable in the one
 * place that records where a picture came from.
 */
export const EXTERNAL_UPLOAD_PROVIDER = 'external_upload'

/** `external_upload:<tool>` -- the tool the human actually used. */
export function externalUploadSource(tool: string): string {
  const slug = tool
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `external_upload:${slug || 'unspecified'}`
}

/** The tools the upload form offers. Free text is accepted too. */
export const EXTERNAL_UPLOAD_TOOLS = ['chatgpt', 'other'] as const
