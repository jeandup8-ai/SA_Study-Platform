import type { Accommodation, Itinerary, PlaceRecord, Preferences, TripView } from '../../shared/types.js'

export interface TripRow {
  id: string
  /** sha256 of the owner's random cookie token. The token itself is never stored. */
  ownerHash: string
  createdAt: string
  updatedAt: string
  accommodation: Accommodation | null
  preferences: Preferences | null
  itinerary: Itinerary | null
  discovery: TripView['discovery']
  /** sha256 of the share token, when a read-only link exists. */
  shareTokenHash: string | null
}

export interface PlaceRow {
  record: PlaceRecord
  selected: boolean
  favourite: boolean
}

export type OrderStatus = 'created' | 'pending' | 'paid' | 'failed'

export interface OrderRow {
  id: string
  tripId: string
  provider: string
  providerOrderId: string
  amount: string
  currency: string
  status: OrderStatus
  captureId: string | null
  createdAt: string
  updatedAt: string
}

export type TripPatch = Partial<Pick<TripRow, 'accommodation' | 'preferences' | 'itinerary' | 'discovery' | 'shareTokenHash'>>

export interface Store {
  readonly kind: 'memory' | 'postgres'
  createTrip(row: TripRow): Promise<void>
  getTrip(id: string): Promise<TripRow | null>
  listTripsByOwner(ownerHash: string): Promise<TripRow[]>
  updateTrip(id: string, patch: TripPatch, now: string): Promise<TripRow | null>
  deleteTrip(id: string): Promise<void>
  findTripByShareHash(hash: string): Promise<TripRow | null>

  getPlaces(tripId: string): Promise<PlaceRow[]>
  /** Replaces the trip's place records; selections survive for ids that remain. */
  replacePlaces(tripId: string, records: PlaceRecord[]): Promise<void>
  deletePlaces(tripId: string, placeIds: string[]): Promise<void>
  setSelection(tripId: string, placeId: string, sel: { selected?: boolean; favourite?: boolean }): Promise<boolean>

  createOrder(row: OrderRow): Promise<void>
  getOrderByProviderId(provider: string, providerOrderId: string): Promise<OrderRow | null>
  /** Moves an order to a new status; a paid order is never moved again. Returns the stored row. */
  updateOrder(id: string, status: OrderStatus, captureId: string | null, now: string): Promise<OrderRow | null>
  hasPaidOrder(tripId: string): Promise<boolean>

  close(): Promise<void>
}
