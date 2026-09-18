import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink, AlertTriangle, CheckCircle2 } from 'lucide-react'
import {
  fetchAdminPracticeTests,
  setPracticeTestPublished,
  removeQuestionFromTest,
  countByLanguage,
  type AdminPracticeTest,
} from '@/lib/admin/practiceTests'

/**
 * Review and publish the free practice tests.
 *
 * Questions are reviewed a whole test at a time rather than one at a time: the
 * thing a reviewer is actually checking -- does this test cover the topic at
 * the right level, and are the answers right -- only makes sense with the other
 * questions in view. Everything a reviewer needs (prompt, options, which option
 * is marked correct, the explanation a learner will read) is on screen, so a
 * test can be checked without opening the database.
 *
 * Nothing is public until `is_published` is set here, and publishing is blocked
 * outright for any test with a question that has no single correct option.
 */
export function PracticeTestsPage() {
  const [tests, setTests] = useState<AdminPracticeTest[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [gradeFilter, setGradeFilter] = useState<number | 'all'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setTests(await fetchAdminPracticeTests())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const grades = useMemo(
    () =>
      [
        ...new Set(tests.map((t) => t.gradeNumber).filter((g): g is number => g != null)),
      ].sort(),
    [tests],
  )
  const visible = useMemo(
    () =>
      gradeFilter === 'all' ? tests : tests.filter((t) => t.gradeNumber === gradeFilter),
    [tests, gradeFilter],
  )
  const publishedCount = visible.filter((t) => t.isPublished).length
  const brokenCount = visible.filter((t) => t.brokenQuestionIds.length > 0).length

  async function togglePublished(test: AdminPracticeTest) {
    setBusyId(test.id)
    setError(null)
    try {
      await setPracticeTestPublished(test, !test.isPublished)
      setTests((prev) =>
        prev.map((t) =>
          t.id === test.id ? { ...t, isPublished: !test.isPublished } : t,
        ),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyId(null)
    }
  }

  async function dropQuestion(testId: string, questionId: string) {
    setBusyId(testId)
    try {
      await removeQuestionFromTest(testId, questionId)
      setTests((prev) =>
        prev.map((t) =>
          t.id === testId
            ? {
                ...t,
                questions: t.questions.filter((q) => q.id !== questionId),
                brokenQuestionIds: t.brokenQuestionIds.filter((id) => id !== questionId),
              }
            : t,
        ),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <p className="text-ink-400">Loading...</p>

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-white">
            Free practice tests
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-300">
            The public, ungated tests at{' '}
            <span className="font-mono text-ink-200">/practice</span>. Check the answers
            and the explanations, then publish — nothing is visible to the public until
            you do.
          </p>
        </div>
        <div className="rounded-xl border border-ink-700 bg-ink-800 px-4 py-2 text-right">
          <p className="text-2xl font-extrabold text-white">
            {publishedCount}/{visible.length}
          </p>
          <p className="text-xs text-ink-300">published</p>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-danger-500 bg-danger-50 px-3 py-2 text-sm font-semibold text-danger-700">
          {error}
        </p>
      )}

      {brokenCount > 0 && (
        <p className="mt-4 flex items-center gap-2 rounded-lg border border-amber-700 bg-amber-950/60 px-3 py-2 text-sm font-semibold text-amber-200">
          <AlertTriangle size={16} />
          {brokenCount} test{brokenCount === 1 ? '' : 's'} contain a question without
          exactly one correct answer and cannot be published.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <FilterChip active={gradeFilter === 'all'} onClick={() => setGradeFilter('all')}>
          All ({tests.length})
        </FilterChip>
        {grades.map((g) => (
          <FilterChip
            key={g}
            active={gradeFilter === g}
            onClick={() => setGradeFilter(g)}
          >
            Grade {g} ({tests.filter((t) => t.gradeNumber === g).length})
          </FilterChip>
        ))}
      </div>

      {visible.length === 0 && (
        <p className="mt-6 text-ink-400">No practice tests yet.</p>
      )}

      <div className="mt-4 space-y-2">
        {visible.map((test) => {
          const counts = countByLanguage(test.questions)
          const expanded = expandedId === test.id
          const broken = test.brokenQuestionIds.length > 0
          return (
            <div key={test.id} className="rounded-2xl border border-ink-700 bg-ink-800">
              <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                <button
                  className="min-w-0 text-left"
                  onClick={() => setExpandedId(expanded ? null : test.id)}
                >
                  <p className="font-bold text-white">{test.titleEn}</p>
                  {test.titleAf && <p className="text-sm text-ink-300">{test.titleAf}</p>}
                  <p className="mt-1 text-xs text-ink-400">
                    Grade {test.gradeNumber} · {test.subjectName} ·{' '}
                    {Object.entries(counts)
                      .map(([lang, n]) => `${n} ${lang.toUpperCase()}`)
                      .join(' · ') || 'no questions'}
                  </p>
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  {broken && <AlertTriangle size={18} className="text-amber-400" />}
                  {test.isPublished && !broken && (
                    <CheckCircle2 size={18} className="text-success-600" />
                  )}
                  {test.isPublished && test.gradeNumber && test.subjectSlug && (
                    <a
                      href={`/practice/grade-${test.gradeNumber}/${test.subjectSlug}/${test.slug}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="rounded-lg border border-ink-600 p-2 text-ink-300 hover:text-white"
                      aria-label="Open public page"
                    >
                      <ExternalLink size={16} />
                    </a>
                  )}
                  <button
                    onClick={() => void togglePublished(test)}
                    disabled={
                      busyId === test.id ||
                      (broken && !test.isPublished) ||
                      test.questions.length === 0
                    }
                    className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
                      test.isPublished ? 'bg-ink-600' : 'bg-success-600'
                    }`}
                  >
                    {test.isPublished ? 'Unpublish' : 'Publish'}
                  </button>
                </div>
              </div>

              {expanded && (
                <div className="space-y-3 border-t border-ink-700 p-4">
                  {test.questions.length === 0 && (
                    <p className="text-sm text-ink-400">No questions attached.</p>
                  )}
                  {test.questions.map((question) => {
                    const correctCount = question.options.filter(
                      (o) => o.is_correct,
                    ).length
                    return (
                      <div
                        key={question.id}
                        className={`rounded-xl border p-3 ${
                          correctCount === 1
                            ? 'border-ink-700'
                            : 'border-amber-700 bg-amber-950/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-semibold text-white">
                            <span className="mr-2 rounded bg-ink-700 px-1.5 text-xs uppercase text-ink-200">
                              {question.language}
                            </span>
                            {question.prompt}
                          </p>
                          <button
                            onClick={() => void dropQuestion(test.id, question.id)}
                            disabled={busyId === test.id}
                            className="shrink-0 text-xs font-semibold text-danger-600 underline disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </div>
                        <ul className="mt-2 space-y-1 text-sm">
                          {question.options.map((option) => (
                            <li
                              key={option.id}
                              className={
                                option.is_correct
                                  ? 'font-bold text-success-600'
                                  : 'text-ink-300'
                              }
                            >
                              {option.is_correct ? '✓ ' : '· '}
                              {option.label}
                            </li>
                          ))}
                        </ul>
                        {correctCount !== 1 && (
                          <p className="mt-2 text-xs font-bold text-amber-300">
                            {correctCount} options marked correct — must be exactly 1.
                          </p>
                        )}
                        {question.explanation && (
                          <p className="mt-2 border-l-2 border-ink-600 pl-3 text-sm text-ink-200">
                            {question.explanation}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
        active ? 'bg-brand-600 text-white' : 'bg-ink-700 text-ink-200 hover:bg-ink-600'
      }`}
    >
      {children}
    </button>
  )
}
