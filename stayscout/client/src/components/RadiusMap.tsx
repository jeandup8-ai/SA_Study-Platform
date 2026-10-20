// A schematic of the 50 km circle: the stay in the centre, each place drawn
// at its true bearing and straight-line distance. Not a street map.

import {
  MAX_RADIUS_M,
  bearingDegrees,
  distanceMeters,
  formatDistance,
  type LatLng,
} from '../../../shared/geo'

interface Point {
  id: string
  name: string
  location: LatLng
  highlighted?: boolean
}

export function RadiusMap({
  origin,
  points,
  label,
}: {
  origin: LatLng
  points: Point[]
  label: string
}) {
  const size = 320
  const c = size / 2
  const r = c - 18
  const plotted = points.map((p) => {
    const d = distanceMeters(origin, p.location)
    const b = (bearingDegrees(origin, p.location) * Math.PI) / 180
    const k = Math.min(d / MAX_RADIUS_M, 1) * r
    return { ...p, x: c + Math.sin(b) * k, y: c - Math.cos(b) * k, d }
  })
  return (
    <figure className="mx-auto w-full max-w-sm">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-labelledby="radius-map-title radius-map-desc"
        className="w-full"
      >
        <title id="radius-map-title">{label}</title>
        <desc id="radius-map-desc">
          A circle of 50 km around your stay with {points.length} place
          {points.length === 1 ? '' : 's'} plotted by direction and straight-line
          distance.
        </desc>
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="var(--color-sea-soft)"
          stroke="var(--color-sea)"
          strokeWidth="1.5"
          strokeDasharray="5 5"
        />
        <circle
          cx={c}
          cy={c}
          r={r / 2}
          fill="none"
          stroke="var(--color-sea)"
          strokeOpacity="0.35"
        />
        <text
          x={c}
          y={c - r / 2 - 4}
          textAnchor="middle"
          fontSize="10"
          fill="var(--color-sea-deep)"
        >
          25 km
        </text>
        <text
          x={c}
          y={c - r + 12}
          textAnchor="middle"
          fontSize="10"
          fill="var(--color-sea-deep)"
        >
          50 km
        </text>
        <text x={c} y={12} textAnchor="middle" fontSize="10" fill="var(--color-muted)">
          N
        </text>
        {plotted.map((p) => (
          <circle
            key={p.id}
            cx={p.x}
            cy={p.y}
            r={p.highlighted ? 5.5 : 3.5}
            fill={p.highlighted ? 'var(--color-coral)' : 'var(--color-sea)'}
            opacity={p.highlighted ? 1 : 0.6}
          >
            <title>
              {p.name} — {formatDistance(p.d)}
            </title>
          </circle>
        ))}
        <circle
          cx={c}
          cy={c}
          r="7"
          fill="var(--color-ink)"
          stroke="white"
          strokeWidth="2"
        />
      </svg>
      <figcaption className="mt-2 text-center text-xs text-muted">
        Schematic: direction and straight-line distance only. Dark dot = your stay
        {plotted.some((p) => p.highlighted) ? '; orange = selected' : ''}.
      </figcaption>
    </figure>
  )
}
