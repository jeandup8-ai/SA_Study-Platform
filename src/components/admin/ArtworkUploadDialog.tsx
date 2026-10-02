import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, Info, Loader2, Upload, X } from 'lucide-react'
import {
  inspectArtworkFile,
  uploadTopicArtwork,
  type UploadValidation,
} from '@/lib/admin/artworkUpload'
import {
  LEVEL_C_MAX_BYTES,
  LEVEL_C_TARGET_EDGE,
  EXTERNAL_UPLOAD_TOOLS,
} from '@/lib/admin/artworkValidation'
import type { TopicIllustrationStatus } from '@/lib/admin/illustrations'

/**
 * Bringing externally generated artwork into the Level C pipeline.
 *
 * The topic is not chosen in here. It is the topic whose card was clicked,
 * and it arrives as a row that already came from the database, so the
 * upload is bound to `topics.id` and never to anything typed, named or
 * inferred from a filename. That is the whole reason this is a per-card
 * action rather than a page-level "upload" button with its own topic
 * picker: a second picker would be a second chance to attach artwork to the
 * wrong grade of an identically named topic, and nine topic slugs in this
 * curriculum collide across grades.
 *
 * Everything below is a convenience over the real gates. Both writes go
 * through RLS policies that check `internal.is_admin()`, and the image
 * stays invisible to learners because it is written `pending` and
 * `media_read` only exposes approved rows.
 */
export function ArtworkUploadDialog({
  topic,
  onClose,
  onUploaded,
}: {
  topic: TopicIllustrationStatus | null
  onClose: () => void
  onUploaded: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [validation, setValidation] = useState<UploadValidation | null>(null)
  const [inspecting, setInspecting] = useState(false)
  const [tool, setTool] = useState<string>('chatgpt')
  const [prompt, setPrompt] = useState('')
  const [supersede, setSupersede] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (topic && !el.open) el.showModal()
    if (!topic && el.open) el.close()
  }, [topic])

  // One object URL per inspected file, revoked when it is replaced or the
  // dialog closes. Without this every re-pick leaks a blob for the lifetime
  // of the tab, and a long review session re-picks a lot.
  useEffect(() => {
    const url = validation?.previewUrl
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [validation?.previewUrl])

  function reset() {
    setFile(null)
    setValidation(null)
    setPrompt('')
    setTool('chatgpt')
    setSupersede(true)
    setError(null)
    setUploading(false)
    setInspecting(false)
  }

  async function handlePick(picked: File | null) {
    setError(null)
    setValidation(null)
    setFile(picked)
    if (!picked) return
    setInspecting(true)
    try {
      setValidation(await inspectArtworkFile(picked))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setInspecting(false)
    }
  }

  async function handleUpload() {
    if (!topic || !file || !validation?.ok) return
    setUploading(true)
    setError(null)
    const result = await uploadTopicArtwork({
      topicId: topic.id,
      file,
      tool,
      prompt,
      supersedeMediaIds: supersede ? topic.pending.map((p) => p.mediaId) : [],
    })
    setUploading(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    onUploaded()
    reset()
    ref.current?.close()
  }

  const hasApproved = Boolean(topic?.approvedMediaId)
  const pendingCount = topic?.pendingCount ?? 0

  return (
    <dialog
      ref={ref}
      onClose={() => {
        reset()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close()
      }}
      className="max-h-[92dvh] w-[min(44rem,92vw)] rounded-2xl border border-ink-700 bg-ink-900 p-0 text-white backdrop:bg-ink-950/80"
    >
      {topic && (
        <div className="flex max-h-[92dvh] flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-ink-700 p-4">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-volt-400">
                Upload artwork
              </p>
              <h2 className="font-display text-lg font-extrabold break-words">
                {topic.name}
              </h2>
              <p className="mt-0.5 text-xs text-ink-400">
                Grade {topic.grade_number} · {topic.subject_name}
              </p>
              {/* The canonical identity, shown so it can be checked against
                  the manifest row before committing. */}
              <p className="mt-1 font-mono text-[11px] text-ink-500 break-all">
                {topic.id}
              </p>
            </div>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              className="shrink-0 rounded-lg p-2 text-ink-300 hover:bg-white/10 hover:text-white"
            >
              <X size={18} aria-hidden />
              <span className="sr-only">Close</span>
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            <ExistingState
              hasApproved={hasApproved}
              approvedUrl={topic.approvedUrl}
              pendingCount={pendingCount}
            />

            <div>
              <label
                htmlFor="artwork-file"
                className="block text-sm font-semibold text-ink-100"
              >
                Image file
              </label>
              <p className="mt-0.5 text-xs text-ink-400">
                Square, opaque, {LEVEL_C_TARGET_EDGE}×{LEVEL_C_TARGET_EDGE}. WebP
                preferred; PNG and JPEG accepted. Up to{' '}
                {Math.round(LEVEL_C_MAX_BYTES / (1024 * 1024))}MB.
              </p>
              <input
                id="artwork-file"
                type="file"
                // Both MIME types and extensions: the same reason the scan
                // uploader lists both, since some platforms report a
                // generic type and the browser then silently drops the file.
                accept="image/webp,image/png,image/jpeg,.webp,.png,.jpg,.jpeg"
                onChange={(e) => void handlePick(e.target.files?.[0] ?? null)}
                className="mt-2 block w-full min-h-11 cursor-pointer rounded-xl border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-200 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-ink-700 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-ink-600"
              />
            </div>

            {inspecting && (
              <p className="flex items-center gap-2 text-sm text-ink-300">
                <Loader2 size={15} className="animate-spin" aria-hidden /> Checking the
                image…
              </p>
            )}

            {validation && (
              <ValidationReport validation={validation} fileName={file?.name ?? ''} />
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="artwork-tool"
                  className="block text-sm font-semibold text-ink-100"
                >
                  Generated with
                </label>
                <p className="mt-0.5 text-xs text-ink-400">
                  Recorded as provenance. Not an API call — this records what a person
                  used.
                </p>
                <select
                  id="artwork-tool"
                  value={
                    EXTERNAL_UPLOAD_TOOLS.includes(tool as 'chatgpt' | 'other')
                      ? tool
                      : 'other'
                  }
                  onChange={(e) => setTool(e.target.value)}
                  className="mt-2 min-h-11 w-full rounded-xl border border-ink-700 bg-ink-950 px-3 text-sm text-white focus:border-volt-500 focus:outline-none"
                >
                  <option value="chatgpt">ChatGPT</option>
                  <option value="other">Other / unspecified</option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="artwork-prompt"
                className="block text-sm font-semibold text-ink-100"
              >
                Prompt used <span className="font-normal text-ink-400">(optional)</span>
              </label>
              <p className="mt-0.5 text-xs text-ink-400">
                Paste the manifest prompt you gave the tool. A reviewer rejecting a weak
                picture can then tell whether the prompt or the model was at fault.
              </p>
              <textarea
                id="artwork-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                className="mt-2 w-full rounded-xl border border-ink-700 bg-ink-950 p-3 text-xs leading-relaxed text-ink-200 focus:border-volt-500 focus:outline-none"
              />
            </div>

            {pendingCount > 0 && (
              <label className="flex items-start gap-3 rounded-xl border border-ink-700 bg-ink-800/60 p-3">
                <input
                  type="checkbox"
                  checked={supersede}
                  onChange={(e) => setSupersede(e.target.checked)}
                  className="mt-0.5 size-4 shrink-0 accent-volt-500"
                />
                <span className="text-sm text-ink-200">
                  Supersede the {pendingCount} image{pendingCount === 1 ? '' : 's'}{' '}
                  already awaiting review for this topic.
                  <span className="mt-0.5 block text-xs text-ink-400">
                    They are marked rejected, not deleted — the rows and the files stay,
                    and the status can be changed back. Leaving this unticked means
                    several candidates sit in the queue for one topic and only the newest
                    shows on the card.
                  </span>
                </span>
              </label>
            )}

            {error && (
              <p className="flex items-start gap-2 rounded-xl bg-danger-500/15 p-3 text-sm font-medium text-danger-500">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />
                <span className="break-words">{error}</span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-ink-700 p-4">
            <button
              type="button"
              onClick={() => void handleUpload()}
              disabled={!validation?.ok || uploading || inspecting}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-volt-500 px-4 font-bold text-ink-950 hover:bg-volt-400 disabled:opacity-40"
            >
              {uploading ? (
                <Loader2 size={16} className="animate-spin" aria-hidden />
              ) : (
                <Upload size={16} aria-hidden />
              )}
              {uploading ? 'Uploading…' : 'Upload for review'}
            </button>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              className="min-h-11 rounded-lg bg-ink-700 px-4 font-semibold text-white hover:bg-ink-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </dialog>
  )
}

/**
 * What already exists for this topic, stated before anything is uploaded.
 *
 * The important sentence is the one about the approved image staying live.
 * An admin uploading a replacement needs to know that nothing changes for
 * learners at the moment of upload, or they will either hesitate to replace
 * anything or assume the swap has already happened.
 */
function ExistingState({
  hasApproved,
  approvedUrl,
  pendingCount,
}: {
  hasApproved: boolean
  approvedUrl: string | null
  pendingCount: number
}) {
  if (!hasApproved && pendingCount === 0) {
    return (
      <p className="flex items-start gap-2 rounded-xl border border-ink-700 bg-ink-800/60 p-3 text-sm text-ink-300">
        <Info size={15} className="mt-0.5 shrink-0 text-ink-400" aria-hidden />
        No artwork exists for this topic yet. The upload will be the first candidate, and
        it will wait for your approval.
      </p>
    )
  }

  return (
    <div className="space-y-2 rounded-xl border border-ink-700 bg-ink-800/60 p-3">
      {hasApproved && (
        <div className="flex items-start gap-3">
          {approvedUrl && (
            <img
              src={approvedUrl}
              alt=""
              className="size-14 shrink-0 rounded-lg bg-ink-950 object-contain"
            />
          )}
          <p className="text-sm text-ink-200">
            <span className="inline-flex items-center gap-1 font-semibold text-success-500">
              <Check size={14} aria-hidden /> An approved image is live for this topic.
            </span>
            <span className="mt-0.5 block text-xs text-ink-400">
              It stays live. A replacement is written as pending and only becomes the
              learner-facing asset once you approve it.
            </span>
          </p>
        </div>
      )}
      {pendingCount > 0 && (
        <p className="text-sm text-gold-300">
          {pendingCount} image{pendingCount === 1 ? '' : 's'} already awaiting review.
        </p>
      )}
    </div>
  )
}

function ValidationReport({
  validation,
  fileName,
}: {
  validation: UploadValidation
  fileName: string
}) {
  const { header, errors, warnings, previewUrl, byteLength, ok } = validation
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-800/60 p-3">
      <div className="flex gap-3">
        <img
          src={previewUrl}
          alt={`Preview of ${fileName}`}
          className="size-24 shrink-0 rounded-lg bg-ink-950 object-contain"
        />
        <div className="min-w-0 text-sm">
          <p className="break-all font-semibold text-white">{fileName}</p>
          <p className="mt-0.5 text-xs text-ink-400">
            {header
              ? `${header.format.toUpperCase()} · ${header.width}×${header.height} · ${
                  byteLength >= 1024 * 1024
                    ? `${(byteLength / (1024 * 1024)).toFixed(1)}MB`
                    : `${Math.round(byteLength / 1024)}KB`
                }`
              : 'Unreadable'}
          </p>
          <p
            className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-bold ${
              ok
                ? 'bg-success-500/20 text-success-500'
                : 'bg-danger-500/20 text-danger-500'
            }`}
          >
            {ok ? <Check size={13} aria-hidden /> : <X size={13} aria-hidden />}
            {ok
              ? 'Structural checks passed'
              : `${errors.length} problem${errors.length === 1 ? '' : 's'}`}
          </p>
        </div>
      </div>

      {errors.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {errors.map((f) => (
            <li
              key={f.rule}
              className="flex items-start gap-2 rounded-lg bg-danger-500/15 px-3 py-2 text-xs text-danger-500"
            >
              <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden />
              <span>{f.message}</span>
            </li>
          ))}
        </ul>
      )}

      {warnings.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {warnings.map((f) => (
            <li
              key={f.rule}
              className="flex items-start gap-2 rounded-lg bg-gold-500/15 px-3 py-2 text-xs text-gold-300"
            >
              <Info size={13} className="mt-0.5 shrink-0" aria-hidden />
              <span>{f.message}</span>
            </li>
          ))}
        </ul>
      )}

      {ok && (
        <p className="mt-2 text-xs text-ink-400">
          These are structural checks only — format, size, shape, opacity. Whether the
          picture teaches the topic is your call in the review step.
        </p>
      )}
    </div>
  )
}
