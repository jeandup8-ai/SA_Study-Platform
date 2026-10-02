import { supabase } from '@/lib/supabase'
import {
  EXTERNAL_UPLOAD_PROVIDER,
  LEVEL_C_MAX_BYTES,
  OPAQUE_ALPHA_THRESHOLD,
  externalUploadSource,
  isUuid,
  mimeTypeFor,
  readImageHeader,
  topicArtworkStoragePath,
  validateLevelCUpload,
  type ValidationResult,
} from '@/lib/admin/artworkValidation'

/**
 * Uploading externally generated Level C artwork into the existing pipeline.
 *
 * Artwork is now produced in ChatGPT rather than through this project's
 * image API, and until this existed there was no way to get it in: the
 * Illustration Studio could generate and review, but a picture made
 * anywhere else had nowhere to go. The temptation was to drop files into
 * `public/topic-art/`, which is exactly the shadow pipeline
 * scripts/check-topic-art.mjs exists to prevent -- a file there is never
 * reviewed and never reaches a learner.
 *
 * So this adds a door into the pipeline that already exists rather than a
 * second pipeline. An upload lands in the same bucket, under the same path
 * layout, as a `media` row with the same approval_status='pending' the
 * generator writes. From the review dialog onward, an uploaded image and a
 * generated one are the same thing.
 *
 * SECURITY. Nothing here is the security boundary, and nothing here needs
 * to be:
 *
 *   - `storage.objects` carries `topic_illustrations_admin_insert`, which
 *     checks `internal.is_admin()`. A non-admin's upload is refused by
 *     Postgres.
 *   - `media` carries `media_admin_write_insert`, same check. A non-admin
 *     cannot create the row either.
 *   - `media_read` is `approval_status = 'approved' OR internal.is_admin()`.
 *     A pending row is unreadable by a learner's session whatever this code
 *     does.
 *
 * Those three policies are enforced in the database against the caller's
 * own JWT, so they hold for a hand-rolled fetch as much as for this module.
 * The checks on this side are there to fail early with a useful message,
 * not to be trusted. That is also why there is no new edge function: the
 * generator needs one because it holds an OpenAI key that must never reach
 * a browser, and an upload has no secret to protect. Adding one would mean
 * a second authorization path to keep correct, guarding something RLS
 * already guards.
 */

export interface UploadValidation extends ValidationResult {
  /** Object URL for previewing the file before committing to it. */
  previewUrl: string
  byteLength: number
}

/**
 * Decodes the file, measures real transparency, and applies every rule.
 *
 * The decode matters on its own: the header parser reads the first few
 * dozen bytes, so it happily accepts a file truncated halfway through its
 * pixel data. `createImageBitmap` is the same decoder that will be asked to
 * render the image in a lesson, so if it refuses here the image was never
 * going to work.
 */
export async function inspectArtworkFile(file: File): Promise<UploadValidation> {
  const bytes = new Uint8Array(await file.arrayBuffer())

  let decoded: boolean | undefined
  let transparentFraction: number | undefined

  // Only worth decoding something plausibly an image and plausibly sized;
  // handing a 40MB blob to the decoder to then reject it on size is work
  // for nothing.
  const header = readImageHeader(bytes)
  if (header && bytes.length <= LEVEL_C_MAX_BYTES) {
    try {
      const bitmap = await createImageBitmap(new Blob([bytes as BlobPart]))
      decoded = true
      transparentFraction = measureTransparency(bitmap) ?? undefined
      bitmap.close()
    } catch {
      decoded = false
    }
  }

  const result = validateLevelCUpload({
    fileName: file.name,
    declaredMimeType: file.type,
    bytes,
    decoded,
    transparentFraction,
  })

  return {
    ...result,
    previewUrl: URL.createObjectURL(file),
    byteLength: bytes.length,
  }
}

/**
 * The share of pixels that are meaningfully see-through.
 *
 * Drawn at natural size rather than scaled down, because scaling
 * interpolates alpha and would turn a hard transparent background into a
 * soft one — which is the exact thing being measured. Returns null when no
 * canvas is available, in which case the caller falls back to the header's
 * alpha flag and says the result is unverified.
 */
function measureTransparency(bitmap: ImageBitmap): number | null {
  let pixels: Uint8ClampedArray
  try {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(bitmap, 0, 0)
    pixels = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data
  } catch {
    return null
  }

  let transparent = 0
  const total = pixels.length / 4
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] < OPAQUE_ALPHA_THRESHOLD) transparent++
  }
  return total === 0 ? null : transparent / total
}

export interface UploadRequest {
  /** From the database, never from a filename or a slug. */
  topicId: string
  file: File
  /** The tool the human used, e.g. 'chatgpt'. Recorded as provenance. */
  tool: string
  /**
   * The prompt the human pasted into that tool. Stored in
   * `media.generation_prompt`, which is the field a reviewer already reads
   * when deciding whether a weak picture came from a weak prompt.
   */
  prompt?: string
  /**
   * Pending rows for this topic that the admin chose to supersede. They are
   * marked rejected, never deleted. Approved rows are never passed here.
   */
  supersedeMediaIds?: string[]
}

export type UploadOutcome =
  | { ok: true; mediaId: string; storagePath: string; superseded: number }
  | { ok: false; error: string }

/**
 * Stores the file and records it as a pending media row.
 *
 * Order matters. The object is uploaded first and the row written second,
 * so the only way to fail halfway is an orphaned storage object — which is
 * inert, costs a megabyte, and is invisible to every query in the product.
 * The reverse order would leave a `media` row whose url 404s, and that one
 * *is* visible: it would show as a broken image in the Studio and, if
 * approved, in a lesson.
 */
export async function uploadTopicArtwork(req: UploadRequest): Promise<UploadOutcome> {
  const { topicId, file, tool, prompt } = req

  if (!isUuid(topicId)) return { ok: false, error: 'invalid_topic_id' }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const header = readImageHeader(bytes)
  // Re-checked here rather than trusting the earlier inspection: this is the
  // call that writes, and the format decides both the storage extension and
  // the content type.
  if (!header) return { ok: false, error: 'unreadable_image' }

  // The topic is re-read through the caller's own session. If the id does
  // not resolve to a real, non-demo topic the upload stops before anything
  // is written, and because the read goes through RLS a caller who cannot
  // see the topic cannot upload against it either.
  const { data: topic, error: topicError } = await supabase
    .from('topics')
    .select('id, is_demo_content')
    .eq('id', topicId)
    .maybeSingle()
  if (topicError)
    return { ok: false, error: `topic_lookup_failed: ${topicError.message}` }
  if (!topic) return { ok: false, error: 'topic_not_found' }
  if (topic.is_demo_content) return { ok: false, error: 'topic_is_demo_content' }

  // Built only from the UUID the database just returned, a clock reading and
  // the sniffed format. Nothing the client named reaches the path.
  const path = topicArtworkStoragePath(topic.id, header.format)

  const { error: uploadError } = await supabase.storage
    .from('topic-illustrations')
    .upload(path, bytes, {
      // From the magic bytes, not from file.type. Storing an attacker-chosen
      // content type on a public bucket is how an "image" gets served as
      // text/html.
      contentType: mimeTypeFor(header.format),
      upsert: false,
    })
  if (uploadError)
    return { ok: false, error: `storage_upload_failed: ${uploadError.message}` }

  const {
    data: { publicUrl },
  } = supabase.storage.from('topic-illustrations').getPublicUrl(path)

  const { data: mediaRow, error: mediaError } = await supabase
    .from('media')
    .insert({
      topic_id: topic.id,
      media_type: 'image',
      provider: EXTERNAL_UPLOAD_PROVIDER,
      url: publicUrl,
      // Written explicitly rather than left to the column default, so that
      // the one line that decides learner visibility is visible in the one
      // place that creates the row.
      approval_status: 'pending',
      source: externalUploadSource(tool),
      language: 'en',
      generation_prompt: prompt?.trim() ? prompt.trim() : null,
    })
    .select('id')
    .single()
  if (mediaError)
    return { ok: false, error: `media_insert_failed: ${mediaError.message}` }

  // Only after the replacement exists. Doing it first would leave a topic
  // with nothing pending if the insert then failed.
  let superseded = 0
  if (req.supersedeMediaIds?.length) {
    superseded = await supersedePendingIllustrations(req.supersedeMediaIds, mediaRow.id)
  }

  return { ok: true, mediaId: mediaRow.id, storagePath: path, superseded }
}

/**
 * Marks superseded pending rows rejected.
 *
 * Nothing is deleted and no storage object is touched; the row and the image
 * both stay, which means a wrong supersede is recoverable by flipping the
 * status back.
 *
 * `approval_status = 'pending'` is in the filter deliberately. It is what
 * makes this unable to touch an approved asset even if the caller passes the
 * wrong id -- the thing a learner is currently seeing cannot be taken away
 * by an upload, only by a human rejecting it in the Studio.
 */
export async function supersedePendingIllustrations(
  mediaIds: string[],
  replacementId: string,
): Promise<number> {
  const ids = mediaIds.filter((id) => isUuid(id) && id !== replacementId)
  if (ids.length === 0) return 0
  const { data, error } = await supabase
    .from('media')
    .update({ approval_status: 'rejected' })
    .in('id', ids)
    .eq('approval_status', 'pending')
    .select('id')
  if (error) return 0
  return data?.length ?? 0
}
