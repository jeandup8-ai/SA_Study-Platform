// Thin client for the StayScout API. All decisions are made server-side.

import type {
  AccommodationCandidate,
  ProviderStatus,
  SafetyPanel,
  TripView,
} from '../../shared/types'
import type { ItineraryEdit, PreferencesInput } from '../../shared/schemas'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: unknown
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(
      0,
      'offline',
      'We could not reach StayScout. Check your connection and try again.',
    )
  }
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const e = data?.error
    throw new ApiError(
      res.status,
      e?.code ?? 'error',
      e?.message ?? 'Something went wrong. Please try again.',
      e?.details,
    )
  }
  return data as T
}

export interface TripSummary {
  id: string
  updatedAt: string
  name: string
  checkIn: string | null
  checkOut: string | null
  isSample: boolean
}

export const api = {
  status: () => call<ProviderStatus>('GET', '/api/status'),
  sample: () => call<TripView>('GET', '/api/sample'),
  searchAccommodation: (query: string, kind: string) =>
    call<{ candidates: AccommodationCandidate[]; isSample: boolean; provider: string }>(
      'POST',
      '/api/accommodation/search',
      { query, kind },
    ),
  listTrips: () => call<{ trips: TripSummary[] }>('GET', '/api/trips'),
  createTrip: (c: AccommodationCandidate) =>
    call<TripView>('POST', '/api/trips', {
      provider: c.provider,
      providerPlaceId: c.providerPlaceId,
    }),
  getTrip: (id: string) => call<TripView>('GET', `/api/trips/${id}`),
  deleteTrip: (id: string) => call<void>('DELETE', `/api/trips/${id}`),
  changeAccommodation: (id: string, c: AccommodationCandidate) =>
    call<{ trip: TripView; removedPlaces: string[]; removedFromPlan: number }>(
      'PUT',
      `/api/trips/${id}/accommodation`,
      { provider: c.provider, providerPlaceId: c.providerPlaceId },
    ),
  confirmAccommodation: (id: string, acknowledgeAreaCentre: boolean) =>
    call<TripView>('POST', `/api/trips/${id}/accommodation/confirm`, {
      acknowledgeAreaCentre,
    }),
  setPreferences: (id: string, prefs: PreferencesInput) =>
    call<TripView>('PUT', `/api/trips/${id}/preferences`, prefs),
  discover: (id: string) => call<TripView>('POST', `/api/trips/${id}/discover`, {}),
  select: (
    id: string,
    placeId: string,
    sel: { selected?: boolean; favourite?: boolean },
  ) => call<{ ok: true }>('PUT', `/api/trips/${id}/selections`, { placeId, ...sel }),
  generate: (id: string, useAi: boolean) =>
    call<TripView>('POST', `/api/trips/${id}/itinerary`, { useAi }),
  regenerateDay: (id: string, day: number) =>
    call<TripView>('POST', `/api/trips/${id}/itinerary/days/${day}/regenerate`, {}),
  editItinerary: (id: string, edit: ItineraryEdit) =>
    call<TripView>('PUT', `/api/trips/${id}/itinerary`, edit),
  safety: (id: string) => call<SafetyPanel>('GET', `/api/trips/${id}/safety`),
  share: (id: string) => call<{ token: string }>('POST', `/api/trips/${id}/share`, {}),
  unshare: (id: string) => call<void>('DELETE', `/api/trips/${id}/share`),
  shared: (token: string) => call<TripView>('GET', `/api/shared/${token}`),
  checkout: (id: string) =>
    call<{ orderId: string }>('POST', `/api/trips/${id}/checkout`, {
      acknowledgeImmediateSupply: true,
    }),
  capture: (id: string, orderId: string) =>
    call<{
      status: 'paid' | 'pending' | 'awaiting_approval' | 'failed'
      reason?: string
    }>('POST', `/api/trips/${id}/checkout/capture`, { orderId }),
}
