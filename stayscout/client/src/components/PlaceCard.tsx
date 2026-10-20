import { useState } from 'react'
import { formatDistance } from '../../../shared/geo'
import type { TripPlace } from '../../../shared/types'
import { CATEGORY_LABEL, directionsUrl, hoursText, priceText } from '../lib'
import { SampleTag, VerificationBadge } from './ui'

interface Props {
  place: TripPlace
  onToggle?: (sel: { selected?: boolean; favourite?: boolean }) => void
  busy?: boolean
}

export function PlaceCard({ place: p, onToggle, busy }: Props) {
  const [open, setOpen] = useState(false)
  const detailsId = `details-${p.id}`
  const dir = directionsUrl(p)
  return (
    <article
      className={`card flex flex-col p-4 transition-colors ${p.selected ? 'border-sea ring-2 ring-sea/30' : ''}`}
      aria-labelledby={`name-${p.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            {CATEGORY_LABEL[p.category]}
          </p>
          <h3 id={`name-${p.id}`} className="font-display text-lg leading-snug">
            {p.name}
          </h3>
        </div>
        {p.isSample && <SampleTag />}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted">Straight-line</dt>
        <dd className="font-medium">{formatDistance(p.distanceMeters)}</dd>
        <dt className="text-muted">Typical visit</dt>
        <dd>
          ~{Math.round(p.durationMinutes.value / 15) * 15} min{' '}
          <span className="text-xs text-muted">(estimate)</span>
        </dd>
        <dt className="text-muted">Cost</dt>
        <dd>{priceText(p)}</dd>
        <dt className="text-muted">Setting</dt>
        <dd className="capitalize">
          {p.setting.value === 'unknown' ? 'Not verified' : p.setting.value}
        </dd>
      </dl>
      {p.warnings.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-coral">
          {p.warnings.map((w) => (
            <li key={w}>⚠ {w}</li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="mt-3 self-start text-sm font-medium text-sea underline-offset-4 hover:underline"
        aria-expanded={open}
        aria-controls={detailsId}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? 'Hide details' : 'Details & sources'}
      </button>
      {open && (
        <div id={detailsId} className="mt-2 space-y-2 border-t border-line pt-3 text-sm">
          <p>{p.address ?? 'Address not available'}</p>
          <p>
            <span className="text-muted">Hours: </span>
            {hoursText(p)}{' '}
            {p.openingHours && <VerificationBadge status={p.openingHours.status} />}
          </p>
          {p.price && (
            <p>
              <span className="text-muted">Price: </span>
              {priceText(p)} <VerificationBadge status={p.price.status} />
            </p>
          )}
          {p.suitability.map((s) => (
            <p key={s.note}>
              {s.note} <VerificationBadge status={s.status} />
            </p>
          ))}
          <p className="text-muted">Category basis: {p.categoryEvidence}</p>
          <p className="text-muted">
            Source:{' '}
            {p.provider === 'demo'
              ? 'StayScout sample dataset (fictional)'
              : p.provider === 'google'
                ? 'Google Places'
                : p.provider}{' '}
            · checked {new Date(p.checkedAt).toLocaleDateString()}
          </p>
          {p.limitations.map((l) => (
            <p key={l} className="text-muted">
              {l}
            </p>
          ))}
          <div className="flex flex-wrap gap-3">
            {p.websiteUrl ? (
              <a
                className="font-medium text-sea underline"
                href={p.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Official website
              </a>
            ) : (
              <span className="text-muted">No website on record</span>
            )}
            {dir ? (
              <a
                className="font-medium text-sea underline"
                href={dir}
                target="_blank"
                rel="noopener noreferrer"
              >
                Directions
              </a>
            ) : (
              <span className="text-muted">Directions unavailable for sample places</span>
            )}
          </div>
          {p.attribution && <p className="text-xs text-muted">{p.attribution}</p>}
        </div>
      )}
      {onToggle && (
        <div className="mt-auto flex gap-2 pt-4">
          <button
            type="button"
            className={`btn flex-1 ${p.selected ? 'btn-primary' : 'btn-secondary'}`}
            aria-pressed={p.selected}
            disabled={busy}
            onClick={() => onToggle({ selected: !p.selected })}
          >
            {p.selected ? '✓ In my plan' : 'Add to plan'}
          </button>
          <button
            type="button"
            className="btn btn-quiet"
            aria-pressed={p.favourite}
            aria-label={
              p.favourite
                ? `Remove ${p.name} from favourites`
                : `Save ${p.name} as a favourite`
            }
            disabled={busy}
            onClick={() => onToggle({ favourite: !p.favourite })}
          >
            <span aria-hidden className={p.favourite ? 'text-coral' : ''}>
              {p.favourite ? '♥' : '♡'}
            </span>
          </button>
        </div>
      )}
    </article>
  )
}
