import { useEffect, useState } from 'react'
import { fetchReviewQueue, updateTopicWorkflowStatus, type ReviewQueueItem } from '@/lib/admin/curriculum'

/**
 * The review queue (spec section 35): for every extracted-but-unverified
 * curriculum record, show exactly what a human needs to check it against the
 * original DBE document — subject, grade, source document, page, and section
 * — right next to the extracted text. Nothing here can be published without
 * a reviewer explicitly clicking Verify.
 */
export function CurriculumReviewPage() {
  const [items, setItems] = useState<ReviewQueueItem[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    setItems(await fetchReviewQueue())
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  async function verify(id: string) {
    await updateTopicWorkflowStatus(id, 'VERIFIED')
    await load()
  }

  async function reject(id: string) {
    await updateTopicWorkflowStatus(id, 'ARCHIVED')
    await load()
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-white">Curriculum review queue</h1>
      <p className="mt-1 text-sm text-slate-400">
        Records extracted by the curriculum importer, awaiting human verification against the original
        source document before they can ever reach a learner.
      </p>

      {loading && <p className="mt-6 text-slate-500">Loading...</p>}
      {!loading && items.length === 0 && (
        <p className="mt-6 text-slate-500">Nothing waiting for review right now.</p>
      )}

      <div className="mt-6 space-y-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-bold text-white">{item.name}</p>
                <p className="text-sm text-slate-400">
                  Grade {item.grade_number} · {item.subject_name}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => void verify(item.id)}
                  className="rounded-lg bg-success-600 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Verify
                </button>
                <button
                  onClick={() => void reject(item.id)}
                  className="rounded-lg bg-danger-600 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Reject
                </button>
              </div>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-500 sm:grid-cols-4">
              <div>
                <dt className="font-semibold text-slate-400">Source</dt>
                <dd>{item.source_title ?? 'unknown'}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-400">Page</dt>
                <dd>{item.source_page ?? '—'}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-400">Section</dt>
                <dd>{item.source_section ?? '—'}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-400">Detected term</dt>
                <dd>{item.term_id ?? 'none detected'}</dd>
              </div>
            </dl>

            <p className="mt-3 rounded-lg bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
              Open the source document to page {item.source_page ?? '?'} and confirm this matches before
              verifying. Heuristic extraction is not authoritative on its own.
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
