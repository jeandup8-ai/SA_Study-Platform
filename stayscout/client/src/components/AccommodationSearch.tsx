import { useState, type FormEvent } from 'react'
import type { AccommodationCandidate } from '../../../shared/types'
import { api } from '../api'
import { EmptyState, ErrorNotice, SampleTag, Spinner } from './ui'

const KINDS = [
  ['any', 'Any stay'],
  ['hotel', 'Hotel'],
  ['resort', 'Resort'],
  ['lodge', 'Lodge'],
  ['guesthouse', 'Guesthouse'],
  ['apartment', 'Holiday apartment'],
  ['other', 'Other'],
  ['destination', 'Just a destination'],
] as const

export function AccommodationSearch({
  onChoose,
  busy,
  demo,
}: {
  onChoose: (c: AccommodationCandidate) => void
  busy?: boolean
  demo: boolean
}) {
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<string>('any')
  const [results, setResults] = useState<AccommodationCandidate[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const search = async (e?: FormEvent) => {
    e?.preventDefault()
    if (query.trim().length < 2) {
      setError(
        new Error(
          'Type at least two characters — the name of your hotel, resort or lodge works best.',
        ),
      )
      return
    }
    setLoading(true)
    setError(null)
    try {
      setResults((await api.searchAccommodation(query.trim(), kind)).candidates)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  const names = new Map<string, number>()
  for (const r of results ?? []) names.set(r.name, (names.get(r.name) ?? 0) + 1)

  return (
    <div className="space-y-4">
      <form onSubmit={search} className="space-y-3" role="search">
        <div>
          <label htmlFor="acc-query" className="field-label">
            Where are you staying?
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="acc-query"
              className="field"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                demo
                  ? 'Try “Kestrel Bay” or “Harbour View Lodge”'
                  : 'Hotel, resort or lodge name and town'
              }
              autoComplete="off"
            />
            <button type="submit" className="btn btn-primary sm:w-36" disabled={loading}>
              Search
            </button>
          </div>
        </div>
        <fieldset>
          <legend className="sr-only">Type of stay</legend>
          <div className="flex flex-wrap gap-2">
            {KINDS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                className="chip"
                aria-pressed={kind === value}
                onClick={() => setKind(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
      </form>

      {loading && <Spinner label="Searching…" />}
      {error ? (
        <ErrorNotice
          error={error}
          onRetry={query.trim().length >= 2 ? () => void search() : undefined}
        />
      ) : null}
      {results && results.length === 0 && !loading && (
        <EmptyState title="No matching stays found">
          Check the spelling, add the town name, or choose “Just a destination”.
          {demo && ' (Demo mode searches a small fictional sample.)'}
        </EmptyState>
      )}
      {results && results.length > 0 && (
        <ul className="space-y-3" aria-label="Matching stays">
          {results.map((r) => (
            <li
              key={`${r.provider}:${r.providerPlaceId}`}
              className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {r.name} {r.isSample && <SampleTag />}
                  {r.isAreaCentre && (
                    <span className="rounded-full bg-sand px-2 py-0.5 text-xs">
                      Area, not a property
                    </span>
                  )}
                </p>
                <p className="text-sm text-muted">
                  {r.address ?? [r.locality, r.country].filter(Boolean).join(', ')}
                </p>
                {(r.disambiguation || (names.get(r.name) ?? 0) > 1) && (
                  <p className="text-sm text-sea-deep">
                    {r.disambiguation ??
                      'Several places share this name — check the address.'}
                  </p>
                )}
                {r.attribution && <p className="text-xs text-muted">{r.attribution}</p>}
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => onChoose(r)}
              >
                This is my stay
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
