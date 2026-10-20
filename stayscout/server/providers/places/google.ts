// Google Places API (New) adapter.
//
// Written against the published Places API (New) request/response schema:
//   POST https://places.googleapis.com/v1/places:searchText
//   POST https://places.googleapis.com/v1/places:searchNearby
//   GET  https://places.googleapis.com/v1/places/{id}
// with the key in X-Goog-Api-Key and an explicit X-Goog-FieldMask (no "*").
// https://developers.google.com/maps/documentation/places/web-service/nearby-search
//
// NOT LIVE-TESTED: the build environment could not reach Google. The parsing
// below is defensive and covered by fixture tests; verify against a real key
// (see README → "Switching to live data") before relying on it.
//
// Terms: Google content may only be cached as the Google Maps Platform terms
// allow. Records from this adapter carry expiresAt (30 days) and attribution;
// the server refreshes or drops them rather than serving stale Google content.

import type { LatLng } from '../../../shared/geo.js'
import type {
  AccommodationCandidate,
  AccommodationKind,
  Interest,
  OpeningPeriod,
  PlaceCategory,
  PriceLevel,
  Setting,
  SourceRecord,
} from '../../../shared/types.js'
import { cleanText, requestJson, safeExternalUrl, type FetchLike } from '../http.js'
import {
  DEFAULT_DURATION_MIN,
  type PlaceCandidate,
  type PlacesProvider,
} from './types.js'

const BASE = 'https://places.googleapis.com/v1'
const CACHE_DAYS = 30
const ATTRIBUTION = 'Place data © Google'

const ACCOMMODATION_FIELDS = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.types',
  'places.addressComponents',
].join(',')

// Fields the place card actually shows. websiteUri / regularOpeningHours /
// priceLevel move the request into a higher SKU; keep this list short.
const PLACE_FIELDS = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'types',
  'primaryType',
  'websiteUri',
  'googleMapsUri',
  'regularOpeningHours',
  'priceLevel',
]
const NEARBY_FIELDS = PLACE_FIELDS.map((f) => `places.${f}`).join(',')

/** Groups of Places "Table A" types, one Nearby Search request per group. */
const TYPE_GROUPS: Array<{ categories: PlaceCategory[]; types: string[] }> = [
  {
    categories: ['culture', 'family', 'rainy_day', 'tour'],
    types: [
      'tourist_attraction',
      'museum',
      'art_gallery',
      'historical_landmark',
      'aquarium',
      'zoo',
      'amusement_park',
    ],
  },
  {
    categories: ['nature', 'park', 'beach', 'wildlife', 'adventure'],
    types: ['park', 'national_park', 'hiking_area'],
  },
  { categories: ['food'], types: ['restaurant', 'cafe'] },
  { categories: ['shopping', 'wellness'], types: ['shopping_mall', 'spa'] },
]

const TYPE_TO_CATEGORY: Array<[string, PlaceCategory, Interest[]]> = [
  ['museum', 'culture', ['culture', 'history']],
  ['art_gallery', 'culture', ['culture']],
  ['historical_landmark', 'culture', ['history', 'culture']],
  ['aquarium', 'family', ['family', 'wildlife']],
  ['zoo', 'wildlife', ['wildlife', 'family']],
  ['amusement_park', 'family', ['family']],
  ['national_park', 'nature', ['nature']],
  ['hiking_area', 'adventure', ['adventure', 'nature']],
  ['park', 'park', ['nature']],
  ['spa', 'wellness', ['wellness']],
  ['shopping_mall', 'shopping', ['shopping']],
  ['restaurant', 'food', ['food']],
  ['cafe', 'food', ['food']],
  ['tourist_attraction', 'culture', ['viewpoints']],
]

const INDOOR_HINT: Partial<Record<PlaceCategory, Setting>> = {
  culture: 'indoor',
  wellness: 'indoor',
  shopping: 'indoor',
  food: 'indoor',
  nature: 'outdoor',
  park: 'outdoor',
  adventure: 'outdoor',
  wildlife: 'outdoor',
  beach: 'outdoor',
}

const PRICE_LEVELS: Record<string, PriceLevel> = {
  PRICE_LEVEL_FREE: 'free',
  PRICE_LEVEL_INEXPENSIVE: 'low',
  PRICE_LEVEL_MODERATE: 'moderate',
  PRICE_LEVEL_EXPENSIVE: 'high',
  PRICE_LEVEL_VERY_EXPENSIVE: 'very_high',
}

const LODGING_KIND: Array<[string, AccommodationKind]> = [
  ['resort_hotel', 'resort'],
  ['guest_house', 'guesthouse'],
  ['bed_and_breakfast', 'guesthouse'],
  ['hostel', 'other'],
  ['motel', 'hotel'],
  ['hotel', 'hotel'],
  ['lodging', 'other'],
]

const AREA_TYPES = new Set([
  'locality',
  'sublocality',
  'administrative_area_level_1',
  'administrative_area_level_2',
  'country',
  'postal_town',
  'neighborhood',
])

type Json = Record<string, unknown>
const obj = (v: unknown): Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Json) : {}
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const strs = (v: unknown): string[] =>
  arr(v).filter((x): x is string => typeof x === 'string')

function parseLocation(v: unknown): unknown {
  const o = obj(v)
  // Left as unknown on purpose: the radius check validates it.
  return { lat: o.latitude, lng: o.longitude }
}

function pad(n: unknown): string {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < 60
    ? String(n).padStart(2, '0')
    : '00'
}

/** regularOpeningHours.periods → our periods. Overnight closes are capped at 24:00. */
export function parseOpeningHours(v: unknown): OpeningPeriod[] | null {
  const periods = arr(obj(v).periods)
  if (periods.length === 0) return null
  const out: OpeningPeriod[] = []
  for (const p of periods) {
    const open = obj(obj(p).open)
    const close = obj(obj(p).close)
    const day = open.day
    if (typeof day !== 'number' || day < 0 || day > 6 || typeof open.hour !== 'number')
      continue
    const openStr = `${pad(open.hour)}:${pad(open.minute)}`
    // No close at all means open 24 hours.
    if (Object.keys(close).length === 0) {
      for (let d = 0; d < 7; d++) out.push({ day: d, open: '00:00', close: '24:00' })
      break
    }
    const closeStr =
      close.day !== day || typeof close.hour !== 'number'
        ? '24:00'
        : `${pad(close.hour)}:${pad(close.minute)}`
    out.push({ day, open: openStr, close: closeStr })
  }
  return out.length > 0 ? out : null
}

export class GooglePlacesProvider implements PlacesProvider {
  readonly name = 'google' as const
  readonly isSample = false
  private readonly apiKey: string
  private readonly fetchImpl: FetchLike
  private readonly now: () => Date

  constructor(
    apiKey: string,
    fetchImpl: FetchLike = fetch,
    now: () => Date = () => new Date(),
  ) {
    this.apiKey = apiKey
    this.fetchImpl = fetchImpl
    this.now = now
  }

  private headers(fieldMask: string) {
    return { 'X-Goog-Api-Key': this.apiKey, 'X-Goog-FieldMask': fieldMask }
  }

  async searchAccommodation(
    query: string,
    kind: AccommodationKind | 'any',
  ): Promise<AccommodationCandidate[]> {
    const body: Json = { textQuery: query, pageSize: 10, languageCode: 'en' }
    if (kind !== 'destination') body.includedType = 'lodging'
    const { data } = await requestJson<Json>({
      provider: 'google-places',
      url: `${BASE}/places:searchText`,
      method: 'POST',
      headers: this.headers(ACCOMMODATION_FIELDS),
      body,
      fetchImpl: this.fetchImpl,
    })
    const out: AccommodationCandidate[] = []
    for (const raw of arr(data.places)) {
      const c = this.toAccommodation(obj(raw))
      if (c) out.push(c)
    }
    return disambiguate(out)
  }

  async resolveAccommodation(
    providerPlaceId: string,
  ): Promise<AccommodationCandidate | null> {
    if (!/^[A-Za-z0-9_-]{10,300}$/.test(providerPlaceId)) return null
    const { data } = await requestJson<Json>({
      provider: 'google-places',
      url: `${BASE}/places/${encodeURIComponent(providerPlaceId)}`,
      headers: this.headers(ACCOMMODATION_FIELDS.replaceAll('places.', '')),
      fetchImpl: this.fetchImpl,
    })
    return this.toAccommodation(data)
  }

  async searchNearby(
    origin: LatLng,
    radiusMeters: number,
    categories: PlaceCategory[],
  ): Promise<PlaceCandidate[]> {
    // Google caps a circle restriction at 50 000 m; never ask for more.
    const radius = Math.min(radiusMeters, 50_000)
    const wanted = new Set(categories)
    const groups = TYPE_GROUPS.filter(
      (g) => wanted.size === 0 || g.categories.some((c) => wanted.has(c)),
    )
    const seen = new Map<string, PlaceCandidate>()
    const results = await Promise.allSettled(
      groups.map((g) =>
        requestJson<Json>({
          provider: 'google-places',
          url: `${BASE}/places:searchNearby`,
          method: 'POST',
          headers: this.headers(NEARBY_FIELDS),
          body: {
            includedTypes: g.types,
            maxResultCount: 20,
            rankPreference: 'POPULARITY',
            languageCode: 'en',
            locationRestriction: {
              circle: { center: { latitude: origin.lat, longitude: origin.lng }, radius },
            },
          },
          fetchImpl: this.fetchImpl,
        }),
      ),
    )
    const failures = results.filter((r) => r.status === 'rejected')
    if (failures.length === results.length && failures.length > 0) {
      throw (failures[0] as PromiseRejectedResult).reason
    }
    for (const r of results) {
      if (r.status !== 'fulfilled') continue
      for (const raw of arr(r.value.data.places)) {
        const c = this.toPlace(obj(raw))
        if (c && !seen.has(c.providerPlaceId)) seen.set(c.providerPlaceId, c)
      }
    }
    return [...seen.values()]
  }

  async getPlaceDetails(providerPlaceId: string): Promise<PlaceCandidate | null> {
    if (!/^[A-Za-z0-9_-]{10,300}$/.test(providerPlaceId)) return null
    const { data } = await requestJson<Json>({
      provider: 'google-places',
      url: `${BASE}/places/${encodeURIComponent(providerPlaceId)}`,
      headers: this.headers(PLACE_FIELDS.join(',')),
      fetchImpl: this.fetchImpl,
    })
    return this.toPlace(data)
  }

  private source(claim: string): SourceRecord {
    return {
      url: null,
      publisher: 'Google Places',
      claim,
      checkedAt: this.now().toISOString(),
      publishedAt: null,
      sourceType: 'place_provider',
      status: 'ok',
    }
  }

  private toAccommodation(p: Json): AccommodationCandidate | null {
    const id = cleanText(p.id, 300)
    const name = cleanText(obj(p.displayName).text)
    if (!id || !name) return null
    const types = strs(p.types)
    const components = arr(p.addressComponents).map(obj)
    const find = (t: string) => components.find((c) => strs(c.types).includes(t))
    const country = find('country')
    const locality = find('locality') ?? find('postal_town')
    const isAreaCentre =
      types.some((t) => AREA_TYPES.has(t)) && !types.includes('lodging')
    return {
      provider: 'google',
      providerPlaceId: id,
      isSample: false,
      name,
      kind: isAreaCentre
        ? 'destination'
        : (LODGING_KIND.find(([t]) => types.includes(t))?.[1] ?? 'other'),
      address: cleanText(p.formattedAddress, 300),
      locality: cleanText(locality?.longText),
      country: cleanText(country?.longText),
      countryCode: cleanText(country?.shortText, 2),
      location: parseLocation(p.location) as LatLng,
      isAreaCentre,
      disambiguation: null,
      attribution: ATTRIBUTION,
    }
  }

  private toPlace(p: Json): PlaceCandidate | null {
    const id = cleanText(p.id, 300)
    const name = cleanText(obj(p.displayName).text)
    if (!id || !name) return null
    const types = strs(p.types)
    const match = TYPE_TO_CATEGORY.find(([t]) => types.includes(t))
    // No evidence that it's something a visitor would seek out: skip it.
    if (!match) return null
    const [matchedType, category, interests] = match
    const hours = parseOpeningHours(p.regularOpeningHours)
    const priceLevel =
      typeof p.priceLevel === 'string' ? (PRICE_LEVELS[p.priceLevel] ?? null) : null
    const now = this.now()
    const setting = INDOOR_HINT[category] ?? 'unknown'
    return {
      provider: 'google',
      providerPlaceId: id,
      isSample: false,
      name,
      category,
      categoryEvidence: `Google Places type "${matchedType}"`,
      interests,
      location: parseLocation(p.location),
      address: cleanText(p.formattedAddress, 300),
      websiteUrl: safeExternalUrl(p.websiteUri),
      bookingUrl: null,
      mapsUrl: safeExternalUrl(p.googleMapsUri),
      setting: {
        value: setting,
        status: setting === 'unknown' ? 'UNVERIFIED' : 'ESTIMATED',
        source: null,
      },
      durationMinutes: {
        value: DEFAULT_DURATION_MIN[category],
        status: 'ESTIMATED',
        source: null,
      },
      price: priceLevel
        ? {
            value: { level: priceLevel, amount: null },
            status: 'PROVIDER_LISTED',
            source: this.source('Price level'),
          }
        : null,
      openingHours: hours
        ? {
            value: hours,
            status: 'PROVIDER_LISTED',
            source: this.source('Regular opening hours'),
          }
        : null,
      suitability: [],
      warnings: [],
      limitations: [
        'Opening hours and prices are as listed by Google and may change; confirm with the venue.',
      ],
      checkedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + CACHE_DAYS * 86_400_000).toISOString(),
      attribution: ATTRIBUTION,
    }
  }
}

/** Adds a distinguishing line when two candidates share a name. */
export function disambiguate(list: AccommodationCandidate[]): AccommodationCandidate[] {
  const counts = new Map<string, number>()
  for (const c of list)
    counts.set(c.name.toLowerCase(), (counts.get(c.name.toLowerCase()) ?? 0) + 1)
  return list.map((c) =>
    (counts.get(c.name.toLowerCase()) ?? 0) > 1 && !c.disambiguation
      ? {
          ...c,
          disambiguation: [c.locality, c.country].filter(Boolean).join(', ') || c.address,
        }
      : c,
  )
}
