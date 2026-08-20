import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  fetchUnverifiedTerminology,
  verifyTerminology,
  deleteTerminology,
  type TerminologyReviewItem,
} from '@/lib/admin/terminology'

/**
 * Terminology verification queue (spec section 23): every subject-vocabulary
 * translation sits here as unverified until a human reviewer confirms the
 * translation is correct, not just plausible. Nothing here is ever surfaced
 * to a learner or the tutor context while `verified = false`.
 */
export function TerminologyReviewPage() {
  const { session } = useAuth()
  const [items, setItems] = useState<TerminologyReviewItem[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    setItems(await fetchUnverifiedTerminology())
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  async function verify(id: string) {
    if (!session) return
    await verifyTerminology(id, session.user.id)
    await load()
  }

  async function reject(id: string) {
    await deleteTerminology(id)
    await load()
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-white">Terminology review queue</h1>
      <p className="mt-1 text-sm text-slate-400">
        Subject-specific translations awaiting human verification. A generic machine translation of a
        technical term is often wrong — nothing here reaches a learner or the AI tutor until a reviewer
        confirms it against the source.
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
                <p className="text-lg font-bold text-white">
                  {item.term} <span className="text-slate-500">→</span> {item.translation ?? '—'}
                </p>
                <p className="text-sm text-slate-400">
                  {item.language.toUpperCase()}
                  {item.subject_name ? ` · ${item.subject_name}` : ''}
                  {item.grade_number ? ` · Grade ${item.grade_number}` : ''}
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
                  Delete
                </button>
              </div>
            </div>

            {item.definition && <p className="mt-3 text-sm text-slate-300">{item.definition}</p>}

            <p className="mt-3 rounded-lg bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
              Source: {item.source_title ?? 'unknown'}. Confirm the translation before verifying — this
              becomes visible to learners and the AI tutor as soon as it is marked verified.
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
