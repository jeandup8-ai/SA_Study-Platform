import type { AccommodationCandidate } from '../../../shared/types.js'
import { DEMO_ACCOMMODATIONS, DEMO_PLACES } from './demo-data.js'
import type { PlaceCandidate, PlacesProvider } from './types.js'

const normalise = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Sample-data provider. It intentionally behaves like a sloppy real provider:
 * searchNearby returns its whole catalogue, including places outside the
 * radius and one with no coordinates, so the server's own radius enforcement
 * is exercised on every demo run.
 */
export class DemoPlacesProvider implements PlacesProvider {
  readonly name = 'demo' as const
  readonly isSample = true

  async searchAccommodation(
    query: string,
    kind: string,
  ): Promise<AccommodationCandidate[]> {
    const words = normalise(query).split(' ').filter(Boolean)
    if (words.length === 0) return []
    return DEMO_ACCOMMODATIONS.filter((a) => {
      if (kind === 'destination' && !a.isAreaCentre) return false
      if (kind !== 'any' && kind !== 'destination' && a.isAreaCentre) return false
      const hay = normalise(`${a.name} ${a.locality ?? ''} ${a.address ?? ''} ${a.kind}`)
      return words.every((w) => hay.includes(w))
    })
  }

  async resolveAccommodation(
    providerPlaceId: string,
  ): Promise<AccommodationCandidate | null> {
    return DEMO_ACCOMMODATIONS.find((a) => a.providerPlaceId === providerPlaceId) ?? null
  }

  async searchNearby(): Promise<PlaceCandidate[]> {
    return structuredClone(DEMO_PLACES)
  }

  async getPlaceDetails(providerPlaceId: string): Promise<PlaceCandidate | null> {
    const p = DEMO_PLACES.find((x) => x.providerPlaceId === providerPlaceId)
    return p ? structuredClone(p) : null
  }
}
