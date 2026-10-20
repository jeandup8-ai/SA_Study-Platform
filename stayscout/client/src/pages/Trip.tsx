import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { PreferencesInput } from '../../../shared/schemas'
import type {
  AccommodationCandidate,
  ItineraryIssue,
  SafetyPanel,
  TripPlace,
  TripView,
} from '../../../shared/types'
import { api, ApiError } from '../api'
import { AccommodationSearch } from '../components/AccommodationSearch'
import { GuideView, SafetyPanelView } from '../components/GuideView'
import { PayPalCheckout } from '../components/PayPalCheckout'
import { PlaceCard } from '../components/PlaceCard'
import { CATEGORY_LABEL, useNoIndex, usePageTitle, useStatus } from '../lib'
import { Questionnaire } from '../components/Questionnaire'
import { RadiusMap } from '../components/RadiusMap'
import {
  EmptyState,
  ErrorNotice,
  RadiusNotice,
  SampleBanner,
  Spinner,
} from '../components/ui'

type Step = 'stay' | 'prefs' | 'discover' | 'plan'
const STEPS: Array<[Step, string]> = [
  ['stay', 'Your stay'],
  ['prefs', 'Your trip'],
  ['discover', 'Places'],
  ['plan', 'Plan & guide'],
]

function defaultStep(t: TripView): Step {
  if (!t.accommodation?.confirmed) return 'stay'
  if (!t.preferences) return 'prefs'
  if (!t.discovery) return 'discover'
  return t.itinerary ? 'plan' : 'discover'
}

export function Trip() {
  useNoIndex()
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const [trip, setTrip] = useState<TripView | null>(null)
  const [loadError, setLoadError] = useState<unknown>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [flash, setFlash] = useState<string | null>(null)
  usePageTitle(trip?.accommodation?.name ?? 'Your trip')

  const load = useCallback(async () => {
    try {
      setTrip(await api.getTrip(id))
      setLoadError(null)
    } catch (err) {
      setLoadError(err)
    }
  }, [id])
  useEffect(() => {
    // Ignore a response for a trip id we've since navigated away from.
    let current = true
    api.getTrip(id).then(
      (t) => {
        if (!current) return
        setTrip(t)
        setLoadError(null)
      },
      (err) => current && setLoadError(err),
    )
    return () => {
      current = false
    }
  }, [id])

  const step: Step =
    (params.get('step') as Step | null) ?? (trip ? defaultStep(trip) : 'stay')
  // After a step change the control that was focused is gone; once the new
  // step has rendered, move focus to its heading for keyboard and
  // screen-reader users.
  const focusStep = useRef(false)
  useEffect(() => {
    if (!focusStep.current) return
    focusStep.current = false
    const h = document.querySelector<HTMLElement>('#step-content :is(h1, h2)')
    if (!h) return
    h.setAttribute('tabindex', '-1')
    h.focus({ preventScroll: true })
  }, [step])

  const go = (s: Step) => {
    setParams({ step: s })
    setError(null)
    window.scrollTo({ top: 0 })
    focusStep.current = true
  }

  /** Runs an action, keeping busy/error state; returns the new trip if any. */
  const run = async <T,>(label: string, fn: () => Promise<T>): Promise<T | null> => {
    setBusy(label)
    setError(null)
    setFlash(null)
    try {
      return await fn()
    } catch (err) {
      setError(err)
      return null
    } finally {
      setBusy(null)
    }
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        {loadError instanceof ApiError && loadError.status === 404 ? (
          <EmptyState title="Trip not found">
            It may have been deleted, or it belongs to another browser. Trips are tied to
            the browser that created them.{' '}
            <Link className="text-sea underline" to="/plan">
              Start a new plan
            </Link>
            .
          </EmptyState>
        ) : (
          <ErrorNotice error={loadError} onRetry={load} />
        )}
      </div>
    )
  }
  if (!trip)
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <Spinner label="Loading your trip…" />
      </div>
    )

  const reached: Record<Step, boolean> = {
    stay: true,
    prefs: Boolean(trip.accommodation?.confirmed),
    discover: Boolean(trip.accommodation?.confirmed && trip.preferences),
    plan: Boolean(trip.discovery && trip.places.length > 0),
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <nav aria-label="Trip steps" className="no-print">
        <ol className="flex gap-1 overflow-x-auto pb-2">
          {STEPS.map(([s, label], i) => (
            <li key={s}>
              <button
                type="button"
                className={`whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium ${s === step ? 'bg-ink text-paper' : reached[s] ? 'text-ink hover:bg-sand' : 'text-muted/60'}`}
                aria-current={s === step ? 'step' : undefined}
                disabled={!reached[s]}
                onClick={() => go(s)}
              >
                {i + 1}. {label}
              </button>
            </li>
          ))}
        </ol>
      </nav>
      {trip.accommodation?.isSample && (
        <div className="no-print mt-3">
          <SampleBanner what="This trip uses" />
        </div>
      )}
      {flash && (
        <p className="mt-4 rounded-2xl bg-sea-soft p-3 text-sea-deep" role="status">
          {flash}
        </p>
      )}
      {error ? (
        <div className="mt-4">
          <ErrorNotice error={error} />
          <IssueList
            issues={
              error instanceof ApiError && Array.isArray(error.details)
                ? (error.details as ItineraryIssue[])
                : []
            }
          />
        </div>
      ) : null}

      <div id="step-content" className="mt-6 fade-in" key={step}>
        {step === 'stay' && (
          <StayStep
            trip={trip}
            busy={busy}
            run={run}
            setTrip={setTrip}
            setFlash={setFlash}
            onNext={() => go(trip.preferences ? 'discover' : 'prefs')}
          />
        )}
        {step === 'prefs' && (
          <section>
            <h1 className="font-display text-3xl">About your trip</h1>
            <p className="mt-2 text-muted">
              Only what helps us plan. Optional questions can be skipped.
            </p>
            <div className="card mt-6 p-5 sm:p-8">
              <Questionnaire
                value={trip.preferences}
                busy={busy !== null}
                onSave={async (p: PreferencesInput) => {
                  const saved = await run('Saving…', async () => {
                    await api.setPreferences(trip.id, p)
                    return api.discover(trip.id)
                  })
                  if (saved) {
                    setTrip(saved)
                    go('discover')
                  }
                }}
              />
            </div>
          </section>
        )}
        {step === 'discover' && (
          <DiscoverStep
            trip={trip}
            busy={busy}
            run={run}
            setTrip={setTrip}
            onPlan={() => go('plan')}
          />
        )}
        {step === 'plan' && (
          <PlanStep
            trip={trip}
            busy={busy}
            run={run}
            setTrip={setTrip}
            setFlash={setFlash}
          />
        )}
      </div>
    </div>
  )
}

type Run = <T>(label: string, fn: () => Promise<T>) => Promise<T | null>

function IssueList({ issues }: { issues: ItineraryIssue[] }) {
  if (issues.length === 0) return null
  return (
    <ul className="mt-2 space-y-1 text-sm">
      {issues.map((i, k) => (
        <li key={k} className={i.severity === 'error' ? 'text-coral' : 'text-amber-ink'}>
          {i.severity === 'error' ? '✕' : '!'} {i.message}
        </li>
      ))}
    </ul>
  )
}

// --------------------------------------------------------------- stay

function StayStep({
  trip,
  busy,
  run,
  setTrip,
  setFlash,
  onNext,
}: {
  trip: TripView
  busy: string | null
  run: Run
  setTrip: (t: TripView) => void
  setFlash: (s: string) => void
  onNext: () => void
}) {
  const status = useStatus()
  const a = trip.accommodation!
  const [changing, setChanging] = useState(false)
  const [ack, setAck] = useState(false)

  const change = async (c: AccommodationCandidate) => {
    const r = await run('Updating…', () => api.changeAccommodation(trip.id, c))
    if (!r) return
    setTrip(r.trip)
    setChanging(false)
    setFlash(
      r.removedPlaces.length > 0
        ? `Accommodation changed. ${r.removedPlaces.length} saved place${r.removedPlaces.length === 1 ? ' is' : 's are'} now more than 50 km away and ${r.removedPlaces.length === 1 ? 'was' : 'were'} removed${r.removedFromPlan ? `, including ${r.removedFromPlan} from your plan` : ''}. Please confirm the new location.`
        : 'Accommodation changed. Please confirm the new location.',
    )
  }

  return (
    <section className="grid gap-8 md:grid-cols-[1fr_20rem]">
      <div>
        <h1 className="font-display text-3xl">Confirm where you’re staying</h1>
        <p className="mt-2 text-muted">
          Every distance in your guide is measured from this point. Please check it’s the
          right property.
        </p>
        <div className="card mt-6 p-5">
          <p className="font-display text-2xl">{a.name}</p>
          <p className="mt-1 text-muted">{a.address ?? 'Address not available'}</p>
          {a.disambiguation && (
            <p className="mt-1 text-sm text-sea-deep">{a.disambiguation}</p>
          )}
          <p className="mt-2 text-sm text-muted">
            Coordinates: {a.location.lat.toFixed(5)}, {a.location.lng.toFixed(5)}
            {!a.isSample && (
              <>
                {' · '}
                <a
                  className="text-sea underline"
                  href={`https://www.openstreetmap.org/?mlat=${a.location.lat}&mlon=${a.location.lng}#map=15/${a.location.lat}/${a.location.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Check this pin on a map
                </a>
              </>
            )}
          </p>
          {a.attribution && <p className="mt-1 text-xs text-muted">{a.attribution}</p>}
          {a.isAreaCentre && (
            <div className="mt-4 rounded-xl bg-amber-soft p-4 text-amber-ink">
              <p>
                <strong>This is a town or area centre, not a specific property.</strong>{' '}
                Distances will be measured from this central point, which may be some way
                from where you actually stay. For accurate distances, search for your
                accommodation by name.
              </p>
              <label className="mt-3 flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                />
                <span>I understand — measure from this area centre.</span>
              </label>
            </div>
          )}
          {a.confirmed ? (
            <p className="mt-4 font-medium text-sea-deep">✓ Location confirmed</p>
          ) : (
            <button
              type="button"
              className="btn btn-primary mt-5"
              disabled={busy !== null || (a.isAreaCentre && !ack)}
              onClick={async () => {
                const t = await run('Confirming…', () =>
                  api.confirmAccommodation(trip.id, ack),
                )
                if (t) {
                  setTrip(t)
                  onNext()
                }
              }}
            >
              Yes, this is the right place
            </button>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            {a.confirmed && (
              <button type="button" className="btn btn-primary" onClick={onNext}>
                Continue
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setChanging((c) => !c)}
              aria-expanded={changing}
            >
              {changing ? 'Keep this stay' : 'Change accommodation'}
            </button>
          </div>
        </div>
        {changing && (
          <div className="card mt-4 p-5">
            <p className="mb-3 text-sm text-muted">
              Changing your stay re-checks every saved place. Anything more than 50 km
              from the new location is removed from your selections and plan.
            </p>
            <AccommodationSearch
              onChoose={change}
              busy={busy !== null}
              demo={status?.places.mode !== 'live'}
            />
          </div>
        )}
      </div>
      <aside>
        <RadiusMap
          origin={a.location}
          points={trip.places.map((p) => ({
            id: p.id,
            name: p.name,
            location: p.location,
            highlighted: p.selected,
          }))}
          label={`The 50 km circle around ${a.name}`}
        />
      </aside>
    </section>
  )
}

// ----------------------------------------------------------- discover

const COSTS = [
  ['any', 'Any cost'],
  ['free', 'Free'],
  ['low', 'Low'],
  ['moderate', 'Moderate'],
  ['high', 'High'],
  ['unknown', 'Cost unknown'],
] as const

function costBucket(p: TripPlace): string {
  const level = p.price?.value.level
  if (!level) return 'unknown'
  return level === 'very_high' ? 'high' : level
}

function DiscoverStep({
  trip,
  busy,
  run,
  setTrip,
  onPlan,
}: {
  trip: TripView
  busy: string | null
  run: Run
  setTrip: (t: TripView) => void
  onPlan: () => void
}) {
  const status = useStatus()
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('all')
  const [cost, setCost] = useState('any')
  const [maxKm, setMaxKm] = useState(50)
  const [setting, setSetting] = useState('any')
  const [show, setShow] = useState<'all' | 'selected' | 'favourites'>('all')
  const [interest, setInterest] = useState('all')
  const [useAi, setUseAi] = useState(true)
  const [pending, setPending] = useState<string | null>(null)

  const places = trip.places
  const categories = useMemo(() => [...new Set(places.map((p) => p.category))], [places])
  const interests = useMemo(
    () => [...new Set(places.flatMap((p) => p.interests))].sort(),
    [places],
  )
  const filtered = places.filter(
    (p) =>
      (!q || `${p.name} ${p.address ?? ''}`.toLowerCase().includes(q.toLowerCase())) &&
      (category === 'all' || p.category === category) &&
      (cost === 'any' || costBucket(p) === cost) &&
      p.distanceMeters <= maxKm * 1000 &&
      (setting === 'any' || p.setting.value === setting) &&
      (interest === 'all' || p.interests.includes(interest as never)) &&
      (show === 'all' || (show === 'selected' ? p.selected : p.favourite)),
  )
  const selectedCount = places.filter((p) => p.selected || p.favourite).length

  const toggle = async (
    p: TripPlace,
    sel: { selected?: boolean; favourite?: boolean },
  ) => {
    setPending(p.id)
    // Optimistic; reverted from the server copy on failure.
    setTrip({
      ...trip,
      places: places.map((x) => (x.id === p.id ? { ...x, ...sel } : x)),
    })
    const ok = await run('Saving…', () => api.select(trip.id, p.id, sel))
    if (!ok) setTrip(trip)
    setPending(null)
  }

  const d = trip.discovery
  if (!d) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-3xl">Find places near your stay</h1>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy !== null}
          onClick={async () => {
            const t = await run('Searching…', () => api.discover(trip.id))
            if (t) setTrip(t)
          }}
        >
          Search within 50 km
        </button>
        {busy && <Spinner label="Searching within 50 km…" />}
      </div>
    )
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Places within 50 km</h1>
          <p className="mt-1 text-muted">
            {places.length} place{places.length === 1 ? '' : 's'} found{' '}
            {d.isSample
              ? 'in the sample dataset'
              : `via ${d.provider === 'google' ? 'Google Places' : d.provider}`}{' '}
            · checked {new Date(d.ranAt).toLocaleString()}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-quiet"
          disabled={busy !== null}
          onClick={async () => {
            const t = await run('Refreshing…', () => api.discover(trip.id))
            if (t) setTrip(t)
          }}
        >
          Refresh results
        </button>
      </div>
      <div className="mt-4 space-y-3">
        <RadiusNotice compact />
        {d.note && (
          <p className="rounded-2xl bg-amber-soft p-3 text-sm text-amber-ink" role="note">
            {d.note}
          </p>
        )}
        {d.rejectedCount > 0 && (
          <p className="text-sm text-muted">
            {d.rejectedCount} result{d.rejectedCount === 1 ? ' was' : 's were'} left out
            {d.rejectedReasons.outside_radius
              ? ` — ${d.rejectedReasons.outside_radius} more than 50 km away`
              : ''}
            {d.rejectedReasons.missing_coordinates
              ? `${d.rejectedReasons.outside_radius ? ',' : ' —'} ${d.rejectedReasons.missing_coordinates} without a usable location`
              : ''}
            .
          </p>
        )}
      </div>

      {places.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="Nothing to plan around yet">
            There are no places within 50 km of this stay in the data we checked. We don’t
            widen the radius. You could change your accommodation, or refresh later.
          </EmptyState>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[17rem_1fr]">
          <aside className="space-y-4" aria-label="Filters">
            <div>
              <label className="field-label" htmlFor="f-q">
                Search results
              </label>
              <input
                id="f-q"
                className="field"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Name or area"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="f-cat">
                Category
              </label>
              <select
                id="f-cat"
                className="field"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="f-int">
                Interest
              </label>
              <select
                id="f-int"
                className="field"
                value={interest}
                onChange={(e) => setInterest(e.target.value)}
              >
                <option value="all">Any interest</option>
                {interests.map((i) => (
                  <option key={i} value={i}>
                    {i[0]!.toUpperCase() + i.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="f-cost">
                Estimated cost
              </label>
              <select
                id="f-cost"
                className="field"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              >
                {COSTS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="f-dist">
                Within {maxKm} km
              </label>
              <input
                id="f-dist"
                type="range"
                min={5}
                max={50}
                step={5}
                value={maxKm}
                onChange={(e) => setMaxKm(Number(e.target.value))}
                className="w-full accent-[var(--color-sea)]"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="f-set">
                Indoor / outdoor
              </label>
              <select
                id="f-set"
                className="field"
                value={setting}
                onChange={(e) => setSetting(e.target.value)}
              >
                <option value="any">Either</option>
                <option value="indoor">Indoor</option>
                <option value="outdoor">Outdoor</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>
            <fieldset>
              <legend className="field-label">Show</legend>
              <div className="flex flex-wrap gap-2">
                {(['all', 'selected', 'favourites'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="chip"
                    aria-pressed={show === s}
                    onClick={() => setShow(s)}
                  >
                    {s === 'all' ? 'All' : s === 'selected' ? 'In my plan' : 'Favourites'}
                  </button>
                ))}
              </div>
            </fieldset>
            <RadiusMap
              origin={trip.accommodation!.location}
              points={filtered.map((p) => ({
                id: p.id,
                name: p.name,
                location: p.location,
                highlighted: p.selected,
              }))}
              label="Filtered places within the 50 km circle"
            />
          </aside>
          <div>
            <p className="mb-3 text-sm text-muted" aria-live="polite">
              Showing {filtered.length} of {places.length}
            </p>
            {filtered.length === 0 ? (
              <EmptyState title="No places match these filters">
                Try widening the distance or clearing a filter.
              </EmptyState>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((p) => (
                  <PlaceCard
                    key={p.id}
                    place={p}
                    busy={pending === p.id}
                    onToggle={(sel) => toggle(p, sel)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {places.length > 0 && (
        <div className="no-print sticky bottom-0 z-10 -mx-4 mt-8 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm">
              <strong>{selectedCount}</strong> chosen
              <span className="hidden sm:inline">
                {selectedCount === 0 && ' — we’ll suggest some from your interests'}
              </span>
            </p>
            <div className="flex items-center gap-2 sm:gap-3">
              {status?.ai.mode === 'live' && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={useAi}
                    onChange={(e) => setUseAi(e.target.checked)}
                  />{' '}
                  Use AI to arrange
                </label>
              )}
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy !== null}
                onClick={async () => {
                  const t = await run('Building your plan…', () =>
                    api.generate(trip.id, useAi && status?.ai.mode === 'live'),
                  )
                  if (t) {
                    setTrip(t)
                    onPlan()
                  }
                }}
              >
                {busy === 'Building your plan…'
                  ? 'Building…'
                  : trip.itinerary
                    ? 'Rebuild my plan'
                    : 'Build my plan'}
              </button>
              {trip.itinerary && (
                <button
                  type="button"
                  className="btn btn-secondary hidden sm:inline-flex"
                  onClick={onPlan}
                >
                  View plan
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

// --------------------------------------------------------------- plan

function PlanStep({
  trip,
  busy,
  run,
  setTrip,
  setFlash,
}: {
  trip: TripView
  busy: string | null
  run: Run
  setTrip: (t: TripView) => void
  setFlash: (s: string) => void
}) {
  const status = useStatus()
  const navigate = useNavigate()
  const [safety, setSafety] = useState<SafetyPanel | null | undefined>(undefined)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [waiver, setWaiver] = useState(false)

  useEffect(() => {
    api.safety(trip.id).then(setSafety, () => setSafety(null))
  }, [trip.id, trip.accommodation?.providerPlaceId])

  const refresh = useCallback(
    async () => setTrip(await api.getTrip(trip.id)),
    [trip.id, setTrip],
  )

  if (!trip.itinerary) {
    return (
      <EmptyState title="No plan yet">
        Choose some places, then build your plan.{' '}
        <button
          type="button"
          className="text-sea underline"
          onClick={() => navigate(`?step=discover`)}
        >
          Go to places
        </button>
      </EmptyState>
    )
  }
  const warnings = trip.issues.filter((i) => i.severity === 'warning')
  const errors = trip.issues.filter((i) => i.severity === 'error')
  const ent = trip.entitlement
  const pay = status?.payments

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        {errors.length > 0 && (
          <div
            className="rounded-2xl border border-coral/30 bg-coral-soft p-4 text-coral"
            role="alert"
          >
            <p className="font-medium">
              This plan needs attention before it can be exported.
            </p>
            <IssueList issues={errors} />
          </div>
        )}
        <GuideView
          trip={trip}
          editable
          busy={busy !== null}
          onEdit={async (edit) => {
            const t = await run('Saving…', () => api.editItinerary(trip.id, edit))
            if (t) setTrip(t)
          }}
          onRegenerateDay={async (day) => {
            const t = await run('Regenerating…', () => api.regenerateDay(trip.id, day))
            if (t) {
              setTrip(t)
              setFlash(`Day ${day + 1} regenerated. Other days are unchanged.`)
            }
          }}
        />
        {warnings.length > 0 && (
          <details className="card p-4">
            <summary className="cursor-pointer font-medium">
              Things to double-check ({warnings.length})
            </summary>
            <IssueList issues={warnings} />
          </details>
        )}
        {safety === undefined ? (
          <Spinner label="Checking safety sources…" />
        ) : (
          <SafetyPanelView safety={safety} />
        )}
      </div>

      <aside className="no-print space-y-4">
        <div className="card space-y-3 p-5">
          <h2 className="font-display text-xl">Your guide</h2>
          {ent.reason === 'payments_not_configured' && (
            <p className="text-sm text-muted">
              Payments aren’t configured here, so the complete guide is unlocked.
            </p>
          )}
          {ent.reason === 'paid' && (
            <p className="text-sm text-sea-deep">✓ Complete guide unlocked</p>
          )}
          {ent.fullGuide ? (
            <>
              <a
                className={`btn btn-primary w-full ${errors.length ? 'pointer-events-none opacity-50' : ''}`}
                href={`/api/trips/${trip.id}/guide.pdf`}
                aria-disabled={errors.length > 0}
              >
                Download PDF
              </a>
              <button
                type="button"
                className="btn btn-secondary w-full"
                onClick={() => window.print()}
              >
                Print
              </button>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm">
                Unlock every day, the PDF and a share link for{' '}
                <strong>
                  {pay?.price.currency} {pay?.price.amount}
                </strong>
                , one-time.
              </p>
              {pay?.clientId ? (
                <>
                  <label className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-5 w-5 shrink-0"
                      checked={waiver}
                      onChange={(e) => setWaiver(e.target.checked)}
                    />
                    <span>
                      I want my complete guide straight away, and I understand that once
                      it’s unlocked I lose my right to cancel within 14 days.
                    </span>
                  </label>
                  {waiver ? (
                    <PayPalCheckout
                      tripId={trip.id}
                      clientId={pay.clientId}
                      price={pay.price}
                      onPaid={refresh}
                    />
                  ) : (
                    <p className="text-xs text-muted">
                      Tick the box above to show payment options.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted">Checkout is unavailable right now.</p>
              )}
              {pay?.mode === 'sandbox' && (
                <p className="text-xs text-muted">
                  PayPal sandbox — test payments only, no real money.
                </p>
              )}
            </div>
          )}
          <button
            type="button"
            className="btn btn-quiet w-full"
            disabled={busy !== null}
            onClick={async () => {
              const t = await run('Rebuilding…', () =>
                api.generate(trip.id, status?.ai.mode === 'live'),
              )
              if (t) setTrip(t)
            }}
          >
            Rebuild the whole plan
          </button>
        </div>

        {ent.fullGuide && (
          <div className="card space-y-3 p-5">
            <h2 className="font-display text-xl">Share read-only</h2>
            <p className="text-sm text-muted">
              Anyone with the link can view (not edit) this guide. Your preferences stay
              private.
            </p>
            {shareUrl ? (
              <>
                <label className="sr-only" htmlFor="share-url">
                  Share link
                </label>
                <input
                  id="share-url"
                  className="field text-sm"
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.target.select()}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary flex-1"
                    onClick={() =>
                      void navigator.clipboard
                        ?.writeText(shareUrl)
                        .then(() => setFlash('Link copied.'))
                    }
                  >
                    Copy
                  </button>
                  <button
                    type="button"
                    className="btn btn-quiet"
                    onClick={async () => {
                      await run('…', () => api.unshare(trip.id))
                      setShareUrl(null)
                      setFlash('Share link turned off.')
                    }}
                  >
                    Turn off
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-secondary w-full"
                disabled={busy !== null}
                onClick={async () => {
                  const r = await run('Creating link…', () => api.share(trip.id))
                  if (r) setShareUrl(`${location.origin}/g/${r.token}`)
                }}
              >
                {trip.shareEnabled
                  ? 'Create a new link (old one stops working)'
                  : 'Create share link'}
              </button>
            )}
          </div>
        )}

        <div className="card space-y-2 p-5 text-sm">
          <h2 className="font-display text-xl">Your data</h2>
          <a
            className="block text-sea underline"
            href={`/api/trips/${trip.id}/export.json`}
          >
            Download my trip data (JSON)
          </a>
          <button
            type="button"
            className="text-coral underline"
            onClick={async () => {
              if (!confirm('Delete this trip permanently? This cannot be undone.')) return
              const ok = await run('Deleting…', () =>
                api.deleteTrip(trip.id).then(() => true),
              )
              if (ok) navigate('/trips')
            }}
          >
            Delete this trip
          </button>
        </div>
      </aside>
    </div>
  )
}
