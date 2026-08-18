import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'

interface Counts {
  grades: number
  subjects: number
  topics: number
  lessons: number
  questions: number
  parents: number
  learners: number
}

interface ModerationRow {
  id: string
  content_type: string
  decision: string
  provider: string
  created_at: string
}

export function AdminDashboardPage() {
  const { t } = useTranslation()
  const [counts, setCounts] = useState<Counts | null>(null)
  const [moderation, setModeration] = useState<ModerationRow[]>([])

  useEffect(() => {
    async function load() {
      const tables = ['grades', 'subjects', 'topics', 'lessons', 'questions', 'parents', 'learners'] as const
      const results = await Promise.all(
        tables.map((table) => supabase.from(table).select('id', { count: 'exact', head: true })),
      )
      const next = {} as Counts
      tables.forEach((table, i) => {
        next[table] = results[i].count ?? 0
      })
      setCounts(next)

      const { data: modRows } = await supabase
        .from('moderation_logs')
        .select('id, content_type, decision, provider, created_at')
        .order('created_at', { ascending: false })
        .limit(10)
      setModeration(modRows ?? [])
    }
    void load()
  }, [])

  return (
    <div>
      <p className="rounded-2xl border border-amber-800 bg-amber-950/40 px-4 py-3 text-sm text-amber-200">
        Foundation admin view — read-only overview today. Full curriculum/lesson/question CRUD editing,
        translation management, and moderation review actions are the next build phase.
      </p>

      <h2 className="mt-6 text-sm font-bold uppercase tracking-wide text-slate-500">{t('admin.curriculum')}</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t('admin.curriculum')} value={counts?.grades} sub="grades" />
        <Stat label="" value={counts?.subjects} sub="subjects" />
        <Stat label="" value={counts?.topics} sub="topics" />
        <Stat label={t('admin.lessons')} value={counts?.lessons} sub="lessons" />
        <Stat label={t('admin.questions')} value={counts?.questions} sub="questions" />
        <Stat label={t('admin.users')} value={counts?.parents} sub="parents" />
        <Stat label="" value={counts?.learners} sub="learners" />
      </div>

      <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-slate-500">{t('admin.moderation')}</h2>
      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Decision</th>
              <th className="px-4 py-2 font-medium">Provider</th>
              <th className="px-4 py-2 font-medium">When</th>
            </tr>
          </thead>
          <tbody>
            {moderation.map((row) => (
              <tr key={row.id} className="border-t border-slate-800">
                <td className="px-4 py-2">{row.content_type}</td>
                <td className="px-4 py-2">
                  <span className={row.decision === 'approved' ? 'text-success-400' : 'text-danger-400'}>
                    {row.decision}
                  </span>
                </td>
                <td className="px-4 py-2 text-slate-400">{row.provider}</td>
                <td className="px-4 py-2 text-slate-400">{new Date(row.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {moderation.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={4}>
                  No moderation events yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: number | undefined; sub: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-2xl font-extrabold text-white">{value ?? '—'}</p>
      <p className="text-xs text-slate-500">{label || sub}</p>
    </div>
  )
}
