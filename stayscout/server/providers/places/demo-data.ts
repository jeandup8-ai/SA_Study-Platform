// SAMPLE DATA — ENTIRELY FICTIONAL.
//
// "Kestrel Bay" and "Marrow Point" do not exist. Every place, price, opening
// time and warning below is invented for demonstration and is labelled as
// sample data everywhere it appears. The anchor coordinates are deliberately
// in the open South Atlantic, far from any coast, so no sample place can be
// mistaken for (or map-linked to) a real location.
//
// Places are positioned by bearing and distance from the resort so the radius
// behaviour is predictable: most are inside 50 km, two are just outside, and
// one has no coordinates at all.

import { destinationPoint, type LatLng } from '../../../shared/geo.js'
import type {
  AccommodationCandidate,
  Interest,
  OpeningPeriod,
  PlaceCategory,
  PriceLevel,
  Setting,
  SourceRecord,
} from '../../../shared/types.js'
import type { PlaceCandidate } from './types.js'

export const SAMPLE_CHECKED_AT = '2026-10-01T09:00:00.000Z'

export const RESORT_LOCATION: LatLng = { lat: -32.4, lng: -20.1 }
const MARROW_POINT: LatLng = destinationPoint(RESORT_LOCATION, 30, 140_000)

const sampleSource = (claim: string): SourceRecord => ({
  url: null,
  publisher: 'StayScout sample dataset (fictional)',
  claim,
  checkedAt: SAMPLE_CHECKED_AT,
  publishedAt: null,
  sourceType: 'sample',
  status: 'ok',
})

export const DEMO_ACCOMMODATIONS: AccommodationCandidate[] = [
  {
    provider: 'demo',
    providerPlaceId: 'demo-acc-kestrel-resort',
    isSample: true,
    name: 'Kestrel Bay Beach Resort',
    kind: 'resort',
    address: '1 Shoreline Drive, Kestrel Bay (fictional)',
    locality: 'Kestrel Bay',
    country: 'Sampleland (fictional)',
    countryCode: null,
    location: RESORT_LOCATION,
    isAreaCentre: false,
    disambiguation: null,
    attribution: null,
  },
  {
    provider: 'demo',
    providerPlaceId: 'demo-acc-harbour-kestrel',
    isSample: true,
    name: 'Harbour View Lodge',
    kind: 'lodge',
    address: '14 Quay Street, Kestrel Bay (fictional)',
    locality: 'Kestrel Bay',
    country: 'Sampleland (fictional)',
    countryCode: null,
    location: destinationPoint(RESORT_LOCATION, 300, 3_000),
    isAreaCentre: false,
    disambiguation: 'In Kestrel Bay, by the old harbour',
    attribution: null,
  },
  {
    provider: 'demo',
    providerPlaceId: 'demo-acc-harbour-marrow',
    isSample: true,
    name: 'Harbour View Lodge',
    kind: 'lodge',
    address: '2 Jetty Road, Marrow Point (fictional)',
    locality: 'Marrow Point',
    country: 'Sampleland (fictional)',
    countryCode: null,
    location: MARROW_POINT,
    isAreaCentre: false,
    disambiguation: 'In Marrow Point, about 140 km north-east of Kestrel Bay',
    attribution: null,
  },
  {
    provider: 'demo',
    providerPlaceId: 'demo-area-kestrel',
    isSample: true,
    name: 'Kestrel Bay (town centre)',
    kind: 'destination',
    address: 'Kestrel Bay (fictional)',
    locality: 'Kestrel Bay',
    country: 'Sampleland (fictional)',
    countryCode: null,
    location: destinationPoint(RESORT_LOCATION, 315, 3_400),
    isAreaCentre: true,
    disambiguation: 'A town, not a specific property',
    attribution: null,
  },
]

interface Spec {
  key: string
  name: string
  category: PlaceCategory
  interests: Interest[]
  at: [bearing: number, meters: number] | null
  from?: LatLng
  setting: Setting
  duration: number
  priceLevel: PriceLevel | null
  amount?: [number, number]
  hours?: OpeningPeriod[]
  suitability?: string[]
  warnings?: string[]
  address: string
}

const everyDay = (open: string, close: string): OpeningPeriod[] =>
  [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, open, close }))
const days = (list: number[], open: string, close: string): OpeningPeriod[] =>
  list.map((day) => ({ day, open, close }))

const SPECS: Spec[] = [
  {
    key: 'main-beach',
    name: 'Kestrel Bay Main Beach',
    category: 'beach',
    interests: ['beaches', 'family'],
    at: [120, 600],
    setting: 'outdoor',
    duration: 180,
    priceLevel: 'free',
    suitability: ['Lifeguard flags in season (sample claim)'],
    address: 'Shoreline Drive, Kestrel Bay',
  },
  {
    key: 'gannet-point',
    name: 'Gannet Point Lighthouse Viewpoint',
    category: 'nature',
    interests: ['viewpoints', 'nature'],
    at: [200, 6_000],
    setting: 'outdoor',
    duration: 90,
    priceLevel: 'free',
    address: 'Gannet Point Road',
  },
  {
    key: 'saltmarsh',
    name: 'Saltmarsh Boardwalk Reserve',
    category: 'wildlife',
    interests: ['wildlife', 'nature', 'family'],
    at: [80, 14_000],
    setting: 'outdoor',
    duration: 120,
    priceLevel: 'low',
    amount: [4, 4],
    hours: everyDay('07:00', '17:00'),
    suitability: ['Level boardwalk; may suit pushchairs (sample claim)'],
    address: 'Marsh Lane, Eastshore',
  },
  {
    key: 'maritime-museum',
    name: 'Kestrel Bay Maritime Museum',
    category: 'culture',
    interests: ['culture', 'history', 'family'],
    at: [315, 3_500],
    setting: 'indoor',
    duration: 120,
    priceLevel: 'low',
    amount: [8, 8],
    hours: days([0, 2, 3, 4, 5, 6], '09:00', '16:30'),
    address: '3 Harbour Square, Kestrel Bay',
  },
  {
    key: 'fish-market',
    name: 'Harbour Fish Market',
    category: 'shopping',
    interests: ['food', 'shopping'],
    at: [305, 3_200],
    setting: 'mixed',
    duration: 60,
    priceLevel: 'low',
    hours: days([0, 6], '07:00', '13:00'),
    address: 'Harbour Wall, Kestrel Bay',
  },
  {
    key: 'driftwood-cafe',
    name: 'The Driftwood Café',
    category: 'food',
    interests: ['food'],
    at: [310, 3_000],
    setting: 'indoor',
    duration: 60,
    priceLevel: 'low',
    hours: everyDay('08:00', '16:00'),
    address: '22 Quay Street, Kestrel Bay',
  },
  {
    key: 'customs-house',
    name: 'Old Customs House Restaurant',
    category: 'food',
    interests: ['food', 'history'],
    at: [318, 3_600],
    setting: 'indoor',
    duration: 120,
    priceLevel: 'high',
    hours: days([0, 3, 4, 5, 6], '18:00', '22:00'),
    address: '1 Customs Lane, Kestrel Bay',
  },
  {
    key: 'cliff-trail',
    name: 'Cliffside Coastal Trail',
    category: 'adventure',
    interests: ['adventure', 'nature', 'viewpoints'],
    at: [230, 11_000],
    setting: 'outdoor',
    duration: 240,
    priceLevel: 'free',
    warnings: ['Sample warning: exposed cliff edges; not suitable in strong wind.'],
    address: 'Trailhead car park, Cliff Road',
  },
  {
    key: 'kelp-snorkel',
    name: 'Kelp Forest Snorkel Tours',
    category: 'tour',
    interests: ['adventure', 'wildlife', 'beaches'],
    at: [150, 4_000],
    setting: 'outdoor',
    duration: 180,
    priceLevel: 'moderate',
    amount: [45, 60],
    hours: everyDay('08:00', '15:00'),
    suitability: ['Minimum age 8 (sample claim)', 'Advance booking required (sample claim)'],
    address: 'South Pier, Kestrel Bay',
  },
  {
    key: 'tidepool-centre',
    name: 'Tidepool Discovery Centre',
    category: 'family',
    interests: ['family', 'wildlife'],
    at: [100, 5_000],
    setting: 'indoor',
    duration: 90,
    priceLevel: 'low',
    amount: [6, 12],
    hours: everyDay('10:00', '17:00'),
    address: '9 Rockpool Way',
  },
  {
    key: 'botanic-garden',
    name: 'Hilltop Botanic Garden',
    category: 'park',
    interests: ['nature', 'viewpoints'],
    at: [10, 19_000],
    setting: 'outdoor',
    duration: 120,
    priceLevel: 'low',
    amount: [5, 5],
    address: 'Summit Road, Hilltop',
  },
  {
    key: 'seaspray-spa',
    name: 'Seaspray Day Spa',
    category: 'wellness',
    interests: ['wellness'],
    at: [60, 2_000],
    setting: 'indoor',
    duration: 150,
    priceLevel: 'high',
    amount: [90, 140],
    hours: everyDay('09:00', '19:00'),
    address: '5 Dune Walk',
  },
  {
    key: 'night-market',
    name: 'Lantern Street Night Market',
    category: 'shopping',
    interests: ['shopping', 'food', 'nightlife'],
    at: [312, 3_400],
    setting: 'outdoor',
    duration: 120,
    priceLevel: 'low',
    hours: days([5, 6], '17:00', '22:00'),
    address: 'Lantern Street, Kestrel Bay',
  },
  {
    key: 'pharmacy',
    name: 'Kestrel Bay Pharmacy',
    category: 'practical',
    interests: [],
    at: [308, 3_100],
    setting: 'indoor',
    duration: 20,
    priceLevel: null,
    hours: days([1, 2, 3, 4, 5, 6], '08:30', '18:00'),
    address: '30 Quay Street, Kestrel Bay',
  },
  {
    key: 'kite-school',
    name: 'Windward Kite & Surf School',
    category: 'adventure',
    interests: ['adventure', 'beaches'],
    at: [170, 8_000],
    setting: 'outdoor',
    duration: 120,
    priceLevel: 'moderate',
    amount: [55, 75],
    hours: everyDay('09:00', '17:00'),
    suitability: ['Minimum age 10 (sample claim)'],
    address: 'Windward Beach car park',
  },
  {
    key: 'penguin-cove',
    name: 'Penguin Rock Cove',
    category: 'wildlife',
    interests: ['wildlife', 'nature', 'family'],
    at: [250, 27_000],
    setting: 'outdoor',
    duration: 90,
    priceLevel: 'free',
    warnings: ['Sample warning: keep at least 5 m from wildlife.'],
    address: 'Cove Road, Westshore',
  },
  {
    key: 'vineyard',
    name: 'Valley Vineyard Tasting Room',
    category: 'food',
    interests: ['food'],
    at: [20, 38_000],
    setting: 'mixed',
    duration: 120,
    priceLevel: 'moderate',
    amount: [20, 35],
    hours: days([3, 4, 5, 6, 0], '11:00', '17:00'),
    suitability: ['Tastings for adults 18+ only (sample claim)'],
    address: 'Valley Road, Upper Kestrel',
  },
  {
    key: 'fort',
    name: 'Fort Kestrel Heritage Site',
    category: 'culture',
    interests: ['history', 'culture', 'viewpoints'],
    at: [280, 22_000],
    setting: 'mixed',
    duration: 120,
    priceLevel: 'low',
    amount: [5, 5],
    hours: everyDay('09:00', '16:00'),
    address: 'Fort Hill, Westshore',
  },
  {
    key: 'pottery',
    name: 'Rainy Day Pottery Studio',
    category: 'rainy_day',
    interests: ['family', 'culture'],
    at: [330, 6_500],
    setting: 'indoor',
    duration: 120,
    priceLevel: 'moderate',
    amount: [25, 25],
    hours: days([2, 3, 4, 5, 6], '10:00', '16:00'),
    address: '7 Kiln Street',
  },
  {
    key: 'northern-dunes',
    name: 'Northern Dunes',
    category: 'nature',
    interests: ['nature', 'adventure', 'viewpoints'],
    at: [355, 47_000],
    setting: 'outdoor',
    duration: 180,
    priceLevel: 'free',
    warnings: ['Sample warning: no shade or water on the dunes.'],
    address: 'Dune Track, North Coast',
  },
  // ---- The next three must be rejected by the server for the resort. ----
  {
    key: 'glass-lake',
    name: 'Glass Lake National Reserve',
    category: 'nature',
    interests: ['nature', 'wildlife'],
    at: [60, 63_000],
    setting: 'outdoor',
    duration: 240,
    priceLevel: 'low',
    address: 'Glass Lake Road (63 km away — outside the radius)',
  },
  {
    key: 'cape-farewell',
    name: 'Cape Farewell Lighthouse',
    category: 'nature',
    interests: ['viewpoints'],
    at: [190, 52_000],
    setting: 'outdoor',
    duration: 90,
    priceLevel: 'free',
    address: 'Cape Farewell (52 km away — just outside the radius)',
  },
  {
    key: 'hidden-falls',
    name: 'Hidden Falls (location unconfirmed)',
    category: 'nature',
    interests: ['nature'],
    at: null,
    setting: 'outdoor',
    duration: 120,
    priceLevel: 'free',
    address: 'Unknown',
  },
  // ---- Near Marrow Point, to show the "few results" state. ----
  {
    key: 'marrow-jetty',
    name: 'Marrow Point Jetty',
    category: 'nature',
    interests: ['viewpoints', 'nature'],
    at: [90, 1_200],
    from: MARROW_POINT,
    setting: 'outdoor',
    duration: 60,
    priceLevel: 'free',
    address: 'Jetty Road, Marrow Point',
  },
  {
    key: 'marrow-store',
    name: 'Marrow Point General Store & Café',
    category: 'food',
    interests: ['food'],
    at: [200, 800],
    from: MARROW_POINT,
    setting: 'indoor',
    duration: 45,
    priceLevel: 'low',
    hours: everyDay('08:00', '17:00'),
    address: '1 Main Street, Marrow Point',
  },
]

function toCandidate(spec: Spec): PlaceCandidate {
  const location = spec.at ? destinationPoint(spec.from ?? RESORT_LOCATION, spec.at[0], spec.at[1]) : undefined
  return {
    provider: 'demo',
    providerPlaceId: `demo-${spec.key}`,
    isSample: true,
    name: spec.name,
    category: spec.category,
    categoryEvidence: 'Assigned in the fictional sample dataset',
    interests: spec.interests,
    location,
    address: `${spec.address} (fictional)`,
    // Fictional places have no website; the UI says so rather than linking anywhere.
    websiteUrl: null,
    bookingUrl: null,
    mapsUrl: null,
    setting: { value: spec.setting, status: 'PROVIDER_LISTED', source: sampleSource('Indoor/outdoor setting') },
    durationMinutes: { value: spec.duration, status: 'ESTIMATED', source: null },
    price: {
      value: {
        level: spec.priceLevel,
        amount: spec.amount ? { min: spec.amount[0], max: spec.amount[1], currency: 'USD' } : null,
      },
      status: 'PROVIDER_LISTED',
      source: sampleSource('Price per person'),
    },
    openingHours: spec.hours
      ? { value: spec.hours, status: 'PROVIDER_LISTED', source: sampleSource('Opening hours') }
      : null,
    suitability: (spec.suitability ?? []).map((note) => ({
      note,
      status: 'PROVIDER_LISTED' as const,
      source: sampleSource(note),
    })),
    warnings: spec.warnings ?? [],
    limitations: ['Fictional sample place — not a real attraction.'],
    checkedAt: SAMPLE_CHECKED_AT,
    expiresAt: null,
    attribution: null,
  }
}

export const DEMO_PLACES: PlaceCandidate[] = SPECS.map(toCandidate)
