import { useEffect, useState } from 'react'
import { fetchCurriculumSources, updateSourceStatus } from '@/lib/admin/curriculum'
import type { Database } from '@/types/database'

type CurriculumSource = Database['public']['Tables']['curriculum_sources']['Row']
type SourceStatus = Database['public']['Enums']['source_verification_status']

const STATUS_COLORS: Record<SourceStatus, string> = {
  PENDING: 'text-ink-300',
  IMPORTED: 'text-sky-400',
  PARSED: 'text-amber-400',
  REVIEW_REQUIRED: 'text-warning-500',
  VERIFIED: 'text-success-400',
  PUBLISHED: 'text-success-400',
  ARCHIVED: 'text-ink-400',
}

export function CurriculumSourcesPage() {
  const [sources, setSources] = useState<CurriculumSource[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    setSources(await fetchCurriculumSources())
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  async function markVerified(id: string) {
    await updateSourceStatus(id, 'VERIFIED')
    await load()
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-white">
        Curriculum sources
      </h1>
      <p className="mt-1 text-sm text-ink-300">
        Official DBE documents this platform knows about. Every entry starts life
        registered in{' '}
        <code className="text-ink-200">curriculum/sources/manifest.json</code> and
        mirrored here. Nothing derived from a source is visible to learners until its
        extracted records are reviewed individually — see the Review Queue tab.
      </p>

      {loading && <p className="mt-6 text-ink-400">Loading...</p>}

      <div className="mt-6 overflow-hidden rounded-2xl border border-ink-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-800 text-ink-300">
            <tr>
              <th className="px-4 py-2 font-medium">Title</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Official URL</th>
              <th className="px-4 py-2 font-medium">Local file</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id} className="border-t border-ink-700">
                <td className="px-4 py-2 text-ink-100">{s.title}</td>
                <td className="px-4 py-2 text-ink-300">{s.document_type}</td>
                <td className={`px-4 py-2 font-semibold ${STATUS_COLORS[s.status]}`}>
                  {s.status}
                </td>
                <td className="max-w-xs truncate px-4 py-2 text-ink-400">
                  {s.official_url ? (
                    <a
                      href={s.official_url}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline"
                    >
                      {s.official_url}
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-2 text-ink-400">
                  {s.local_file_path ?? 'not uploaded'}
                </td>
                <td className="px-4 py-2">
                  {s.status === 'REVIEW_REQUIRED' && (
                    <button
                      onClick={() => void markVerified(s.id)}
                      className="rounded-lg bg-success-600 px-3 py-1 text-xs font-semibold text-white"
                    >
                      Mark source verified
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!loading && sources.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-ink-400" colSpan={6}>
                  No sources registered yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
