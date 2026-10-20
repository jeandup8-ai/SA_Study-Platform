import type { LatLng } from '../../../shared/geo.js'
import type {
  AccommodationCandidate,
  AccommodationKind,
  PlaceCategory,
  PlaceRecord,
  Preferences,
  ProviderName,
} from '../../../shared/types.js'

/**
 * What a provider hands back before our own validation. `location` is
 * deliberately `unknown`: nothing a provider says is trusted until the radius
 * check has run on it.
 */
export type PlaceCandidate = Omit<PlaceRecord, 'id' | 'location'> & { location: unknown }

export interface PlacesProvider {
  readonly name: ProviderName
  readonly isSample: boolean
  searchAccommodation(query: string, kind: AccommodationKind | 'any'): Promise<AccommodationCandidate[]>
  resolveAccommodation(providerPlaceId: string): Promise<AccommodationCandidate | null>
  /**
   * `radiusMeters` is passed by the server from MAX_RADIUS_M. Providers may
   * use it to narrow their search, but their results are always re-checked.
   */
  searchNearby(
    origin: LatLng,
    radiusMeters: number,
    categories: PlaceCategory[],
    preferences: Preferences | null,
  ): Promise<PlaceCandidate[]>
  getPlaceDetails(providerPlaceId: string): Promise<PlaceCandidate | null>
}

/** Straight-line → road estimates are not routing; this interface is for a real router. */
export interface RoutingProvider {
  readonly name: string
  calculateRoute(
    origin: LatLng,
    destination: LatLng,
    mode: 'walking' | 'driving' | 'transit',
  ): Promise<{ distanceMeters: number; durationSeconds: number; source: string } | null>
}

export const noRouting: RoutingProvider = {
  name: 'none',
  async calculateRoute() {
    return null
  },
}

/** Rough visit durations when nothing better is known. Always labelled ESTIMATED. */
export const DEFAULT_DURATION_MIN: Record<PlaceCategory, number> = {
  nature: 120,
  beach: 180,
  park: 90,
  wildlife: 120,
  culture: 120,
  tour: 180,
  food: 75,
  family: 120,
  shopping: 90,
  adventure: 180,
  wellness: 120,
  rainy_day: 90,
  practical: 20,
}
