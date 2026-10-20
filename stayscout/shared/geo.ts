// Geodesic distance and the 50 km radius rule.
//
// This file is the single source of truth for "is this place within range".
// The server calls it after every provider search, after merging providers,
// on every itinerary save, on edits, on regeneration and before PDF export.
// The client imports it only for display; it never decides eligibility.

/**
 * Mean Earth radius in metres (IUGG R1 = (2a + b) / 3 for WGS-84).
 * Haversine on a sphere differs from the WGS-84 ellipsoid by up to ~0.5%,
 * i.e. up to ~250 m at 50 km. That is documented and accepted for a
 * straight-line "within 50 km" rule; it is not used for navigation.
 */
export const EARTH_RADIUS_M = 6_371_008.8

/** The product invariant. Server-controlled; never read from a request. */
export const MAX_RADIUS_M = 50_000

/**
 * Absorbs floating-point noise only (a millimetre), so a point computed to be
 * 50 000.0000001 m away is treated as on the boundary. It is far too small to
 * admit any genuinely out-of-range place.
 */
export const RADIUS_EPSILON_M = 0.001

export interface LatLng {
  lat: number
  lng: number
}

export class InvalidCoordinatesError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidCoordinatesError'
  }
}

/** True only for finite numbers inside the valid latitude/longitude ranges. */
export function isValidLatLng(value: unknown): value is LatLng {
  if (typeof value !== 'object' || value === null) return false
  const { lat, lng } = value as Record<string, unknown>
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  )
}

function assertLatLng(value: unknown, label: string): asserts value is LatLng {
  if (!isValidLatLng(value)) {
    throw new InvalidCoordinatesError(`${label} has missing or invalid coordinates`)
  }
}

const toRad = (deg: number) => (deg * Math.PI) / 180

/**
 * Great-circle distance in metres using the haversine formula. Handles
 * identical points (0), the antimeridian (longitude differences are taken
 * through sin² so 179.9 and -179.9 are 0.2° apart) and the poles.
 */
export function distanceMeters(a: LatLng, b: LatLng): number {
  assertLatLng(a, 'Origin')
  assertLatLng(b, 'Destination')
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  // Clamp: rounding can push h a hair above 1 for antipodal points.
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Inclusive: a place exactly 50 000 m away qualifies. */
export function isWithinRadius(origin: LatLng, point: unknown): boolean {
  if (!isValidLatLng(point)) return false
  return distanceMeters(origin, point) <= MAX_RADIUS_M + RADIUS_EPSILON_M
}

export type RadiusRejection = 'missing_coordinates' | 'outside_radius'

export interface RadiusResult<T> {
  qualifying: Array<T & { distanceMeters: number }>
  rejected: Array<{ item: T; reason: RadiusRejection; distanceMeters?: number }>
}

/**
 * Splits candidates into those inside the radius (annotated with their
 * freshly computed distance) and those rejected, with a reason. Any distance
 * already present on a candidate is ignored and overwritten.
 */
export function partitionByRadius<T extends { location?: unknown }>(
  origin: LatLng,
  candidates: readonly T[],
): RadiusResult<T> {
  assertLatLng(origin, 'Accommodation')
  const result: RadiusResult<T> = { qualifying: [], rejected: [] }
  for (const item of candidates) {
    if (!isValidLatLng(item.location)) {
      result.rejected.push({ item, reason: 'missing_coordinates' })
      continue
    }
    const d = distanceMeters(origin, item.location)
    if (d <= MAX_RADIUS_M + RADIUS_EPSILON_M) {
      result.qualifying.push({ ...item, distanceMeters: d })
    } else {
      result.rejected.push({ item, reason: 'outside_radius', distanceMeters: d })
    }
  }
  return result
}

/** "850 m", "4.2 km", "37 km" — for display only. */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`
  if (meters < 10_000) return `${(meters / 1000).toFixed(1)} km`
  return `${Math.round(meters / 1000)} km`
}

/** Initial bearing in degrees (0 = north), used to draw the radius map. */
export function bearingDegrees(a: LatLng, b: LatLng): number {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat))
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng))
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

/** Destination point given a start, bearing and distance (used by tests and demo data checks). */
export function destinationPoint(origin: LatLng, bearingDeg: number, meters: number): LatLng {
  const δ = meters / EARTH_RADIUS_M
  const θ = toRad(bearingDeg)
  const φ1 = toRad(origin.lat)
  const λ1 = toRad(origin.lng)
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ))
  const λ2 =
    λ1 +
    Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2))
  const lng = ((((λ2 * 180) / Math.PI + 540) % 360) + 360) % 360 - 180
  return { lat: (φ2 * 180) / Math.PI, lng }
}
