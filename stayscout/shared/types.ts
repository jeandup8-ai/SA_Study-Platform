// Domain model shared by server and client. The server is authoritative; the
// client receives these shapes as JSON.

import type { LatLng } from './geo.js'

/**
 * Verification applies to individual claims (hours, price, suitability),
 * never to a whole place.
 */
export type VerificationStatus =
  | 'VERIFIED_SOURCE' // confirmed against a reliable, cited source
  | 'PROVIDER_LISTED' // a real provider record says so; not independently checked
  | 'ESTIMATED' // an explicitly identified estimate
  | 'UNVERIFIED' // insufficient evidence
  | 'UNAVAILABLE' // the source or service could not be checked

export type ProviderName = 'demo' | 'google'

export type PlaceCategory =
  | 'nature'
  | 'beach'
  | 'park'
  | 'wildlife'
  | 'culture'
  | 'tour'
  | 'food'
  | 'family'
  | 'shopping'
  | 'adventure'
  | 'wellness'
  | 'rainy_day'
  | 'practical'

export type Interest =
  | 'beaches'
  | 'nature'
  | 'wildlife'
  | 'food'
  | 'culture'
  | 'shopping'
  | 'history'
  | 'adventure'
  | 'nightlife'
  | 'wellness'
  | 'viewpoints'
  | 'family'

export type Setting = 'indoor' | 'outdoor' | 'mixed' | 'unknown'

export type PriceLevel = 'free' | 'low' | 'moderate' | 'high' | 'very_high'

export interface SourceRecord {
  url: string | null
  publisher: string
  claim: string
  checkedAt: string // ISO timestamp of when we accessed it
  publishedAt: string | null
  sourceType: 'place_provider' | 'official_website' | 'government' | 'sample' | 'other'
  status: 'ok' | 'failed'
  error?: string
}

export interface Claim<T> {
  value: T
  status: VerificationStatus
  source: SourceRecord | null
}

export interface OpeningPeriod {
  /** 0 = Sunday … 6 = Saturday */
  day: number
  open: string // "HH:MM" local time
  close: string // "HH:MM" local time; "24:00" allowed
}

export interface PriceInfo {
  level: PriceLevel | null
  /** Per person, when a number is actually known. */
  amount: { min: number; max: number; currency: string } | null
}

export interface PlaceRecord {
  id: string // internal id, stable within a trip
  provider: ProviderName
  providerPlaceId: string
  isSample: boolean
  name: string
  category: PlaceCategory
  /** Why we put it in that category; categories need evidence too. */
  categoryEvidence: string
  interests: Interest[]
  location: LatLng
  address: string | null
  websiteUrl: string | null
  bookingUrl: string | null
  mapsUrl: string | null
  setting: Claim<Setting>
  durationMinutes: Claim<number> // usually ESTIMATED
  price: Claim<PriceInfo> | null
  openingHours: Claim<OpeningPeriod[]> | null
  suitability: Array<{
    note: string
    status: VerificationStatus
    source: SourceRecord | null
  }>
  warnings: string[]
  limitations: string[]
  checkedAt: string
  /** Provider-content cache expiry, when the provider's terms require one. */
  expiresAt: string | null
  attribution: string | null
}

/** A place as returned to the client for a trip: always re-measured. */
export interface TripPlace extends PlaceRecord {
  distanceMeters: number
  selected: boolean
  favourite: boolean
}

export type AccommodationKind =
  'hotel' | 'resort' | 'lodge' | 'guesthouse' | 'apartment' | 'other' | 'destination'

export interface AccommodationCandidate {
  provider: ProviderName
  providerPlaceId: string
  isSample: boolean
  name: string
  kind: AccommodationKind
  address: string | null
  locality: string | null
  country: string | null
  countryCode: string | null
  location: LatLng
  /** True when this is an area/city centre, not a specific property. */
  isAreaCentre: boolean
  disambiguation: string | null
  attribution: string | null
}

export interface Accommodation extends AccommodationCandidate {
  confirmed: boolean
  confirmedAt: string | null
  resolvedAt: string
}

export type TripType =
  'honeymoon' | 'family' | 'solo' | 'group' | 'adventure' | 'relaxation' | 'general'

export type TransportMode =
  'walking' | 'public' | 'rental_car' | 'taxi' | 'guided' | 'undecided'

export type Pace = 'relaxed' | 'balanced' | 'packed'

export type ChildAgeRange = '0-2' | '3-5' | '6-12' | '13-17'

export interface Preferences {
  checkIn: string // YYYY-MM-DD
  checkOut: string // YYYY-MM-DD
  adults: number
  childAgeRanges: ChildAgeRange[]
  tripType: TripType
  budget: { amount: number; currency: string } | null
  transport: TransportMode
  interests: Interest[]
  pace: Pace
  accessibilityNeeds: string | null
  dietaryPreferences: string | null
  sensitiveNotesConsent: boolean
  settingPreference: 'indoor' | 'outdoor' | 'no_preference'
  language: string
}

export type Slot = 'morning' | 'lunch' | 'afternoon' | 'evening'

export interface ItineraryItem {
  id: string
  slot: Slot
  kind: 'activity' | 'meal' | 'free'
  placeId: string | null
  title: string
  startTime: string // HH:MM
  durationMinutes: number
  /** Rough estimate from straight-line distance; never live traffic. */
  travelMinutesEstimate: number | null
  notes: string[]
}

export interface ItineraryDay {
  date: string // YYYY-MM-DD
  label: string
  items: ItineraryItem[]
  notes: string[]
  /** Sum of known per-person prices × travellers, in one currency; null when nothing is priced. */
  estimatedCost: { min: number; max: number; currency: string } | null
  /** Items whose cost is unknown or in another currency, so not in estimatedCost. */
  unpricedItems: number
}

export interface Itinerary {
  version: number
  generatedBy: 'deterministic' | 'ai'
  generatedAt: string
  accommodationKey: string // provider:providerPlaceId it was built around
  days: ItineraryDay[]
  warnings: string[]
}

export interface ItineraryIssue {
  severity: 'error' | 'warning'
  code: string
  message: string
  dayIndex?: number
  itemId?: string
  placeId?: string
}

export interface SafetyEntry {
  status: 'source_retrieved' | 'not_found' | 'unavailable' | 'not_checked'
  title: string
  summary: string
  source: SourceRecord | null
  limitations: string[]
}

export interface SafetyPanel {
  checkedAt: string
  entries: SafetyEntry[]
  officialLinks: Array<{ title: string; url: string }>
  disclaimer: string
}

export interface ProviderStatus {
  places: { mode: 'demo' | 'live'; provider: ProviderName }
  ai: { mode: 'off' | 'live'; provider: string | null }
  payments: {
    mode: 'off' | 'sandbox' | 'live'
    provider: string | null
    clientId: string | null
    price: { amount: string; currency: string }
  }
  safety: { mode: 'off' | 'live'; provider: string | null }
  storage: 'memory' | 'postgres'
}

export interface Entitlement {
  fullGuide: boolean
  reason: 'paid' | 'payments_not_configured' | 'preview' | 'sample'
  /** Days withheld from this response because the guide is not unlocked. */
  lockedDays: number
}

export interface TripView {
  id: string
  createdAt: string
  updatedAt: string
  accommodation: Accommodation | null
  preferences: Preferences | null
  places: TripPlace[]
  discovery: {
    ranAt: string
    provider: ProviderName
    isSample: boolean
    rejectedCount: number
    rejectedReasons: Record<string, number>
    note: string | null
  } | null
  itinerary: Itinerary | null
  issues: ItineraryIssue[]
  entitlement: Entitlement
  shareEnabled: boolean
  readOnly: boolean
}
