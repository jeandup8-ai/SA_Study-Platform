import { describe, expect, it } from 'vitest'
import {
  InvalidCoordinatesError,
  MAX_RADIUS_M,
  destinationPoint,
  distanceMeters,
  formatDistance,
  isValidLatLng,
  isWithinRadius,
  partitionByRadius,
} from '../shared/geo.js'

const origin = { lat: -33.9249, lng: 18.4241 }

describe('distanceMeters', () => {
  it('returns zero for identical coordinates', () => {
    expect(distanceMeters(origin, { ...origin })).toBe(0)
  })

  it('matches a known reference distance (London–Paris ≈ 343.5 km)', () => {
    const london = { lat: 51.5074, lng: -0.1278 }
    const paris = { lat: 48.8566, lng: 2.3522 }
    expect(distanceMeters(london, paris) / 1000).toBeCloseTo(343.5, 0)
  })

  it('handles the international date line', () => {
    const west = { lat: -17.0, lng: 179.9 }
    const east = { lat: -17.0, lng: -179.9 }
    const d = distanceMeters(west, east)
    // 0.2° of longitude at 17° S ≈ 21.3 km, not ~40 000 km the long way round.
    expect(d).toBeGreaterThan(20_000)
    expect(d).toBeLessThan(22_000)
    expect(isWithinRadius(west, east)).toBe(true)
  })

  it('is symmetric', () => {
    const b = { lat: -34.1, lng: 18.9 }
    expect(distanceMeters(origin, b)).toBeCloseTo(distanceMeters(b, origin), 6)
  })

  it.each([
    [{ lat: 91, lng: 0 }],
    [{ lat: -91, lng: 0 }],
    [{ lat: 0, lng: 180.5 }],
    [{ lat: Number.NaN, lng: 0 }],
    [{ lat: 0, lng: Number.POSITIVE_INFINITY }],
    [{ lat: '12', lng: 3 }],
    [null],
    [undefined],
    [{}],
  ])('rejects invalid coordinates %j', (bad) => {
    expect(() => distanceMeters(origin, bad as never)).toThrow(InvalidCoordinatesError)
    expect(isValidLatLng(bad)).toBe(false)
  })
})

describe('isWithinRadius (50 km)', () => {
  it('includes a nearby point', () => {
    expect(isWithinRadius(origin, destinationPoint(origin, 45, 800))).toBe(true)
  })

  it('includes a point clearly inside 50 km', () => {
    expect(isWithinRadius(origin, destinationPoint(origin, 200, 35_000))).toBe(true)
  })

  it('excludes a point clearly outside 50 km', () => {
    expect(isWithinRadius(origin, destinationPoint(origin, 90, 65_000))).toBe(false)
  })

  it('excludes a point just 1 m beyond the boundary', () => {
    const p = destinationPoint(origin, 10, MAX_RADIUS_M + 1)
    expect(distanceMeters(origin, p)).toBeGreaterThan(MAX_RADIUS_M)
    expect(isWithinRadius(origin, p)).toBe(false)
  })

  it('handles a point on the boundary consistently (inclusive)', () => {
    for (const bearing of [0, 73, 180, 271]) {
      const p = destinationPoint(origin, bearing, MAX_RADIUS_M)
      expect(Math.abs(distanceMeters(origin, p) - MAX_RADIUS_M)).toBeLessThan(0.001)
      expect(isWithinRadius(origin, p)).toBe(true)
    }
  })

  it('treats missing coordinates as not within range', () => {
    expect(isWithinRadius(origin, undefined)).toBe(false)
    expect(isWithinRadius(origin, { lat: null, lng: null })).toBe(false)
  })
})

describe('partitionByRadius', () => {
  it('splits candidates, recomputes distance and gives reasons', () => {
    const items = [
      {
        id: 'in',
        location: destinationPoint(origin, 0, 10_000),
        distanceMeters: 999_999,
      },
      { id: 'out', location: destinationPoint(origin, 0, 50_500) },
      { id: 'nocoords', location: undefined },
      { id: 'bad', location: { lat: 200, lng: 0 } },
    ]
    const { qualifying, rejected } = partitionByRadius(origin, items)
    expect(qualifying.map((q) => q.id)).toEqual(['in'])
    // Any distance the provider sent is replaced by our own calculation.
    expect(qualifying[0]!.distanceMeters).toBeCloseTo(10_000, 0)
    expect(rejected.map((r) => [r.item.id, r.reason])).toEqual([
      ['out', 'outside_radius'],
      ['nocoords', 'missing_coordinates'],
      ['bad', 'missing_coordinates'],
    ])
  })

  it('refuses an invalid origin', () => {
    expect(() => partitionByRadius({ lat: 100, lng: 0 }, [])).toThrow(
      InvalidCoordinatesError,
    )
  })
})

describe('formatDistance', () => {
  it('rounds sensibly', () => {
    expect(formatDistance(0)).toBe('10 m')
    expect(formatDistance(846)).toBe('850 m')
    expect(formatDistance(4_240)).toBe('4.2 km')
    expect(formatDistance(37_400)).toBe('37 km')
  })
})
