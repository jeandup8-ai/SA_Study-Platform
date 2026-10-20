import { formatDistance } from '../../../shared/geo'
import type { ItineraryEdit } from '../../../shared/schemas'
import { retimeDay } from '../../../shared/travel'
import type {
  ItineraryDay,
  ItineraryItem,
  SafetyPanel as Safety,
  TripPlace,
  TripView,
} from '../../../shared/types'
import { directionsUrl, fmtDate, priceText } from '../lib'
import { RadiusNotice, SampleTag } from './ui'

const SLOT_LABEL: Record<string, string> = {
  morning: 'Morning',
  lunch: 'Lunch',
  afternoon: 'Afternoon',
  evening: 'Evening',
}

interface Props {
  trip: TripView
  editable?: boolean
  onEdit?: (edit: ItineraryEdit) => Promise<void>
  onRegenerateDay?: (dayIndex: number) => Promise<void>
  busy?: boolean
}

export function GuideView({
  trip,
  editable = false,
  onEdit,
  onRegenerateDay,
  busy,
}: Props) {
  const itin = trip.itinerary
  const byId = new Map(trip.places.map((p) => [p.id, p]))
  if (!itin) return null
  const a = trip.accommodation!

  const submit = (days: Array<{ date: string; items: ItineraryItem[] }>) =>
    onEdit?.({
      version: itin.version,
      days: days.map((d) => ({
        date: d.date,
        items: d.items.map(({ id, slot, kind, placeId, startTime, durationMinutes }) => ({
          id,
          slot,
          kind,
          placeId,
          startTime,
          durationMinutes,
        })),
      })),
    })

  const transport = trip.preferences?.transport ?? 'undecided'
  const retime = (items: ItineraryItem[], dayStart: string) =>
    retimeDay(
      items,
      (id) => byId.get(id)?.location ?? null,
      a.location,
      transport,
      dayStart,
    )

  const move = (dayIndex: number, itemIndex: number, delta: -1 | 1) => {
    const days = itin.days.map((d) => ({ date: d.date, items: [...d.items] }))
    const items = days[dayIndex]!.items
    const j = itemIndex + delta
    if (j < 0 || j >= items.length) return
    const dayStart = items[0]!.startTime
    ;[items[itemIndex], items[j]] = [items[j]!, items[itemIndex]!]
    days[dayIndex]!.items = retime(items, dayStart)
    return submit(days)
  }

  const remove = (dayIndex: number, itemIndex: number) => {
    const days = itin.days.map((d) => ({ date: d.date, items: [...d.items] }))
    days[dayIndex]!.items.splice(itemIndex, 1)
    return submit(days)
  }

  const moveToDay = (from: number, itemIndex: number, to: number) => {
    const days = itin.days.map((d) => ({ date: d.date, items: [...d.items] }))
    const [item] = days[from]!.items.splice(itemIndex, 1)
    const target = days[to]!.items
    days[to]!.items = retime(
      [...target, item!],
      target[0]?.startTime ?? (to === 0 ? '15:00' : '09:30'),
    )
    return submit(days)
  }

  return (
    <div className="space-y-6">
      <header className="card overflow-hidden">
        <div className="bg-sea px-5 py-6 text-paper sm:px-8">
          <p className="eyebrow !text-sun-light">Your StayScout guide</p>
          <h2 className="mt-1 font-display text-3xl leading-tight sm:text-4xl">
            {a.name}
          </h2>
          {trip.preferences && (
            <p className="mt-2 text-paper/85">
              {fmtDate(trip.preferences.checkIn)} – {fmtDate(trip.preferences.checkOut)}
            </p>
          )}
        </div>
        <div className="space-y-3 p-5 sm:px-8">
          <p className="text-sm text-muted">
            {a.address ?? 'Address not available'} · Confirmed location{' '}
            {a.location.lat.toFixed(5)}, {a.location.lng.toFixed(5)}
            {a.isAreaCentre && ' (area centre, not a specific property)'}
          </p>
          <RadiusNotice compact />
          {itin.generatedBy === 'ai' && (
            <p className="text-sm text-muted">
              Arranged with AI assistance from your validated place list, then checked by
              StayScout.
            </p>
          )}
          {itin.warnings.map((w) => (
            <p
              key={w}
              className="rounded-xl bg-amber-soft p-3 text-sm text-amber-ink"
              role="note"
            >
              {w}
            </p>
          ))}
        </div>
      </header>

      {itin.days.map((day, dayIndex) => (
        <DayCard
          key={day.date}
          day={day}
          dayIndex={dayIndex}
          dayCount={itin.days.length}
          byId={byId}
          editable={editable && !busy}
          onMove={(i, d) => move(dayIndex, i, d)}
          onRemove={(i) => remove(dayIndex, i)}
          onMoveToDay={(i, to) => moveToDay(dayIndex, i, to)}
          onRegenerate={onRegenerateDay ? () => onRegenerateDay(dayIndex) : undefined}
          dayLabels={itin.days.map((d) => d.label)}
        />
      ))}

      {trip.entitlement.lockedDays > 0 && (
        <div className="card border-dashed p-6 text-center">
          <p className="font-display text-xl">
            {trip.entitlement.lockedDays} more day
            {trip.entitlement.lockedDays === 1 ? '' : 's'} in your complete guide
          </p>
          <p className="mt-1 text-muted">
            Unlock the full plan and PDF below. Your preview shows the first day.
          </p>
        </div>
      )}
    </div>
  )
}

function DayCard({
  day,
  dayIndex,
  dayCount,
  byId,
  editable,
  onMove,
  onRemove,
  onMoveToDay,
  onRegenerate,
  dayLabels,
}: {
  day: ItineraryDay
  dayIndex: number
  dayCount: number
  byId: Map<string, TripPlace>
  editable: boolean
  onMove: (i: number, d: -1 | 1) => void
  onRemove: (i: number) => void
  onMoveToDay: (i: number, to: number) => void
  onRegenerate?: () => void
  dayLabels: string[]
}) {
  const cost = day.estimatedCost
  return (
    <section className="card p-5 sm:p-6" aria-labelledby={`day-${dayIndex}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`day-${dayIndex}`} className="font-display text-2xl">
          {day.label}
        </h3>
        <p className="text-sm text-muted">{fmtDate(day.date)}</p>
      </div>
      <p className="mt-1 text-sm text-muted">
        {cost
          ? `Known activity costs: ${cost.currency} ${cost.min.toFixed(0)}${cost.max !== cost.min ? `–${cost.max.toFixed(0)}` : ''} for your group`
          : 'No priced activities this day'}
        {day.unpricedItems > 0 &&
          ` · ${day.unpricedItems} item${day.unpricedItems === 1 ? '' : 's'} with unknown cost`}
      </p>
      {day.notes.map((n) => (
        <p key={n} className="mt-2 text-sm text-muted">
          {n}
        </p>
      ))}
      {day.items.length === 0 && (
        <p className="mt-4 text-muted">Nothing planned — a free day.</p>
      )}
      <ol className="mt-4 space-y-3">
        {day.items.map((item, i) => {
          const place = item.placeId ? byId.get(item.placeId) : undefined
          const dir = place ? directionsUrl(place) : null
          return (
            <li
              key={item.id}
              className="grid grid-cols-[4.25rem_1fr] gap-3 border-t border-line pt-3 first:border-t-0 first:pt-0"
            >
              <div>
                <p className="font-semibold tabular-nums">{item.startTime}</p>
                <p className="text-xs text-muted">{SLOT_LABEL[item.slot]}</p>
              </div>
              <div>
                <p className="font-medium">
                  {item.title} {place?.isSample && <SampleTag />}
                </p>
                <p className="text-sm text-muted">
                  ~{item.durationMinutes} min
                  {item.travelMinutesEstimate
                    ? ` · ~${item.travelMinutesEstimate} min travel before (rough estimate, not live traffic)`
                    : ''}
                </p>
                {place && (
                  <p className="text-sm text-muted">
                    {place.address ?? 'Address not available'} ·{' '}
                    {formatDistance(place.distanceMeters)} from your stay ·{' '}
                    {priceText(place)}
                  </p>
                )}
                {item.notes.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-sm">
                    {item.notes.map((n) => (
                      <li
                        key={n}
                        className={
                          /warning|Age check|Too far/i.test(n)
                            ? 'text-coral'
                            : 'text-muted'
                        }
                      >
                        {n}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {place?.websiteUrl && (
                    <a
                      className="text-sea underline"
                      href={place.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Official site / booking
                    </a>
                  )}
                  {dir && (
                    <a
                      className="text-sea underline"
                      href={dir}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Directions
                    </a>
                  )}
                </div>
                {editable && (
                  <div className="no-print mt-2 flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      className="btn btn-quiet !min-h-9 text-sm"
                      disabled={i === 0}
                      onClick={() => onMove(i, -1)}
                      aria-label={`Move ${item.title} earlier`}
                    >
                      ↑ Earlier
                    </button>
                    <button
                      type="button"
                      className="btn btn-quiet !min-h-9 text-sm"
                      disabled={i === day.items.length - 1}
                      onClick={() => onMove(i, 1)}
                      aria-label={`Move ${item.title} later`}
                    >
                      ↓ Later
                    </button>
                    {dayCount > 1 && (
                      <label className="text-sm">
                        <span className="sr-only">Move {item.title} to another day</span>
                        <select
                          className="field !min-h-9 !w-auto !py-1 text-sm"
                          value=""
                          onChange={(e) =>
                            e.target.value && onMoveToDay(i, Number(e.target.value))
                          }
                        >
                          <option value="">Move to…</option>
                          {dayLabels.map((l, d) =>
                            d === dayIndex ? null : (
                              <option key={l} value={d}>
                                {l}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                    )}
                    <button
                      type="button"
                      className="btn btn-quiet !min-h-9 text-sm text-coral"
                      onClick={() => onRemove(i)}
                      aria-label={`Remove ${item.title}`}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      {editable && onRegenerate && (
        <button
          type="button"
          className="btn btn-secondary no-print mt-4"
          onClick={onRegenerate}
        >
          Regenerate this day only
        </button>
      )}
    </section>
  )
}

export function SafetyPanelView({ safety }: { safety: Safety | null }) {
  return (
    <section className="card p-5 sm:p-6" aria-labelledby="safety-heading">
      <h3 id="safety-heading" className="font-display text-2xl">
        Safety & official advice
      </h3>
      {!safety ? (
        <p className="mt-2 text-muted">
          Safety information could not be loaded. Check official travel advice before you
          go.
        </p>
      ) : (
        <>
          <div className="mt-3 space-y-3">
            {safety.entries.map((e) => (
              <div key={e.title} className="rounded-xl border border-line p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {SAFETY_STATUS[e.status]}
                </p>
                <p className="mt-1 font-medium">{e.title}</p>
                <p className="mt-1 text-sm text-muted">{e.summary}</p>
                {e.source && e.source.status === 'ok' && e.source.url && (
                  <p className="mt-2 text-sm">
                    <a
                      className="text-sea underline"
                      href={e.source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {e.source.publisher}
                    </a>
                    {e.source.publishedAt &&
                      ` · updated ${fmtDate(e.source.publishedAt.slice(0, 10))}`}{' '}
                    · checked {new Date(e.source.checkedAt).toLocaleString()}
                  </p>
                )}
                {e.limitations.map((l) => (
                  <p key={l} className="mt-1 text-xs text-muted">
                    Limitation: {l}
                  </p>
                ))}
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm font-medium">Official sources to check yourself</p>
          <ul className="mt-1 space-y-1 text-sm">
            {safety.officialLinks.map((l) => (
              <li key={l.url}>
                <a
                  className="text-sea underline"
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {l.title}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-4 rounded-xl bg-sand p-3 text-sm">{safety.disclaimer}</p>
        </>
      )}
    </section>
  )
}

const SAFETY_STATUS: Record<string, string> = {
  source_retrieved: 'Official source retrieved',
  not_found: 'No matching advice found in the sources checked',
  unavailable: 'Could not be verified',
  not_checked: 'Not checked',
}
