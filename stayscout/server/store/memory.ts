// In-memory store: used when DATABASE_URL is unset and in tests. Trips are
// lost on restart, and the provider-status panel says so.

import type { PlaceRecord } from '../../shared/types.js'
import type {
  OrderRow,
  OrderStatus,
  PlaceRow,
  Store,
  TripPatch,
  TripRow,
} from './types.js'

export class MemoryStore implements Store {
  readonly kind = 'memory' as const
  private trips = new Map<string, TripRow>()
  private places = new Map<string, Map<string, PlaceRow>>()
  private orders = new Map<string, OrderRow>()

  async createTrip(row: TripRow) {
    this.trips.set(row.id, structuredClone(row))
    this.places.set(row.id, new Map())
  }

  async getTrip(id: string) {
    const t = this.trips.get(id)
    return t ? structuredClone(t) : null
  }

  async listTripsByOwner(ownerHash: string) {
    return [...this.trips.values()]
      .filter((t) => t.ownerHash === ownerHash)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((t) => structuredClone(t))
  }

  async updateTrip(id: string, patch: TripPatch, now: string) {
    const t = this.trips.get(id)
    if (!t) return null
    Object.assign(t, structuredClone(patch), { updatedAt: now })
    return structuredClone(t)
  }

  async deleteTrip(id: string) {
    this.trips.delete(id)
    this.places.delete(id)
    for (const [k, o] of this.orders) if (o.tripId === id) this.orders.delete(k)
  }

  async findTripByShareHash(hash: string) {
    for (const t of this.trips.values())
      if (t.shareTokenHash === hash) return structuredClone(t)
    return null
  }

  async getPlaces(tripId: string) {
    return [...(this.places.get(tripId)?.values() ?? [])].map((p) => structuredClone(p))
  }

  async replacePlaces(tripId: string, records: PlaceRecord[]) {
    const old = this.places.get(tripId) ?? new Map<string, PlaceRow>()
    const next = new Map<string, PlaceRow>()
    for (const r of records) {
      const prev = old.get(r.id)
      next.set(r.id, {
        record: structuredClone(r),
        selected: prev?.selected ?? false,
        favourite: prev?.favourite ?? false,
      })
    }
    this.places.set(tripId, next)
  }

  async deletePlaces(tripId: string, placeIds: string[]) {
    const m = this.places.get(tripId)
    for (const id of placeIds) m?.delete(id)
  }

  async setSelection(
    tripId: string,
    placeId: string,
    sel: { selected?: boolean; favourite?: boolean },
  ) {
    const row = this.places.get(tripId)?.get(placeId)
    if (!row) return false
    if (sel.selected !== undefined) row.selected = sel.selected
    if (sel.favourite !== undefined) row.favourite = sel.favourite
    return true
  }

  async createOrder(row: OrderRow) {
    for (const o of this.orders.values()) {
      if (o.provider === row.provider && o.providerOrderId === row.providerOrderId)
        throw new Error('duplicate order')
    }
    this.orders.set(row.id, structuredClone(row))
  }

  async getOrderByProviderId(provider: string, providerOrderId: string) {
    for (const o of this.orders.values()) {
      if (o.provider === provider && o.providerOrderId === providerOrderId)
        return structuredClone(o)
    }
    return null
  }

  async updateOrder(
    id: string,
    status: OrderStatus,
    captureId: string | null,
    now: string,
  ) {
    const o = this.orders.get(id)
    if (!o) return null
    if (o.status !== 'paid')
      Object.assign(o, { status, captureId: captureId ?? o.captureId, updatedAt: now })
    return structuredClone(o)
  }

  async hasPaidOrder(tripId: string) {
    return [...this.orders.values()].some(
      (o) => o.tripId === tripId && o.status === 'paid',
    )
  }

  async close() {}
}
