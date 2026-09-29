import { Camera, FileText, ShieldCheck, UploadCloud } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/**
 * The invitation to upload schoolwork.
 *
 * Previously two full-width buttons stacked on a white page, which gave no
 * sense that this is the place you bring something to. It is now a framed
 * area with the two controls inside it, so the page reads as somewhere to
 * drop work rather than a form with two submit buttons.
 *
 * The file inputs themselves are unchanged, deliberately and down to the
 * `accept` strings -- every part of them is load-bearing and was arrived at
 * the hard way. See the comments on each.
 */
export function UploadZone({ onFile }: { onFile: (file: File) => void }) {
  const { t } = useTranslation()

  // One handler for both inputs. Clearing `value` afterwards matters: without
  // it, picking the same file twice in a row fires no change event at all.
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onFile(file)
    e.target.value = ''
  }

  return (
    <div className="mt-6">
      <div className="rounded-panel border-2 border-dashed border-brand-200 bg-brand-50/50 px-4 py-6 text-center">
        <span
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-brand-600 shadow-card"
          aria-hidden
        >
          <UploadCloud size={26} />
        </span>

        <div className="mt-5 space-y-3 text-left">
          {/* A <label> wrapping the real <input type="file"> — clicking anywhere in the
              label natively forwards to the input with zero JS or CSS-stacking games
              involved. This replaced a "transparent input positioned over a button" trick
              that turned out not to be reliable enough in practice. The visual "button" is
              a plain <span> (not a nested <button>), since nesting one interactive control
              inside another can make browsers handle the forwarded click inconsistently.
              Image and PDF are separate inputs deliberately: combining a forced camera
              capture with a non-image accept type on one input is a known Android Chrome
              trap that can kill and reload the whole tab returning from the camera app.

              The image input needs the `image/*` wildcard, not just the enumerated
              jpeg/png/webp types: a gallery photo can report a MIME the enumerated list
              doesn't cover (HEIC on many Samsung/Android cameras, or whatever a specific
              gallery/cloud provider decides to report), which silently filtered it out
              of the picker before this was added. */}
          <label className="block cursor-pointer">
            <input
              type="file"
              accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif"
              className="peer sr-only"
              onChange={handleChange}
            />
            <span className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-panel bg-brand-600 px-7 text-lg font-semibold text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-700 active:bg-brand-800">
              <Camera size={20} aria-hidden /> {t('scan.uploadCta')}
            </span>
          </label>

          {/* `accept` lists both a MIME type AND a file extension: on Android, picking a
              PDF from Google Drive/Files/a third-party file manager often returns a
              content:// document whose reported MIME type is generic (e.g.
              application/octet-stream) or blank rather than application/pdf. An accept
              filter of MIME-type-only can then cause Chrome to drop the selection
              silently — the picker closes, the input's change event fires with an empty
              FileList, and the screen just looks like it "did nothing". Pairing the MIME
              type with the .pdf extension is the standard fix: most Android document
              providers match on either. */}
          <label className="block cursor-pointer">
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="peer sr-only"
              onChange={handleChange}
            />
            <span className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-panel border-2 border-brand-200 bg-white px-7 text-lg font-semibold text-brand-700 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-700 active:bg-brand-50">
              <FileText size={20} aria-hidden /> {t('scan.uploadPdf')}
            </span>
          </label>
        </div>
      </div>

      <p className="mt-4 flex items-start gap-3 rounded-card bg-slate-100/70 px-4 py-3 text-xs text-slate-500">
        <ShieldCheck className="mt-0.5 shrink-0 text-brand-600" size={18} aria-hidden />
        {t('scan.safetyNote')}
      </p>
    </div>
  )
}
