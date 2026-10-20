// Rough travel-time estimates and clock helpers, shared so the client can
// re-time a day after a reorder with exactly the numbers the server validates.
// These are planning estimates from straight-line distance, never live traffic.

import { distanceMeters, type LatLng } from './geo.js'
import type { ItineraryItem, Slot, TransportMode } from './types.js'

/** Average door-to-door speeds for a rough estimate. */
export const SPEED_KMH: Record<TransportMode, number> = {
  walking: 4.5,
  public: 18,
  rental_car: 40,
  taxi: 35,
  guided: 35,
  undecided: 35,
}
/** Parking, waiting, pick-up. */
export const OVERHEAD_MIN: Record<TransportMode, number> = {
  walking: 0,
  public: 15,
  rental_car: 10,
  taxi: 10,
  guided: 10,
  undecided: 10,
}
/** Roads are longer than straight lines; 1.3 is a common rule of thumb. */
export const DETOUR_FACTOR = 1.3

export const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}
export const fromMinutes = (min: number): string => {
  const m = Math.max(0, Math.min(min, 24 * 60 - 1))
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
export const roundUp5 = (n: number) => Math.ceil(n / 5) * 5

export function travelMinutes(meters: number, mode: TransportMode): number {
  if (meters < 150) return 0
  const km = (meters / 1000) * DETOUR_FACTOR
  return roundUp5(OVERHEAD_MIN[mode] + (km / SPEED_KMH[mode]) * 60)
}

export function slotFor(kind: ItineraryItem['kind'], startMin: number): Slot {
  if (startMin >= toMinutes('17:30')) return 'evening'
  if (kind === 'meal' && startMin >= toMinutes('11:30')) return 'lunch'
  return startMin < toMinutes('12:00') ? 'morning' : 'afternoon'
}

/**
 * Lays items out back-to-back in the given order from `dayStart`, leaving the
 * estimated travel time between stops. Used after a traveller reorders a day.
 */
export function retimeDay<
  T extends Pick<
    ItineraryItem,
    'kind' | 'placeId' | 'startTime' | 'durationMinutes' | 'slot'
  >,
>(
  items: T[],
  locate: (placeId: string) => LatLng | null,
  origin: LatLng,
  mode: TransportMode,
  dayStart: string,
): T[] {
  let cursor = toMinutes(dayStart)
  let at = origin
  return items.map((item) => {
    const loc = item.placeId ? locate(item.placeId) : null
    const travel = loc ? travelMinutes(distanceMeters(at, loc), mode) : 0
    if (loc) at = loc
    const start = roundUp5(cursor + travel)
    cursor = start + item.durationMinutes
    return { ...item, startTime: fromMinutes(start), slot: slotFor(item.kind, start) }
  })
}
