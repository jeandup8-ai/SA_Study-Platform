// The public sample guide: built from the fictional demo dataset with the
// same service code a real trip uses, so it shows real behaviour.

import type { TripView } from '../shared/types.js'
import type { Config } from './config.js'
import { DemoPlacesProvider } from './providers/places/demo.js'
import { NoSafetyProvider } from './providers/safety.js'
import { TripService } from './service.js'
import { MemoryStore } from './store/memory.js'

const SAMPLE_PICKS = [
  'Kestrel Bay Maritime Museum',
  'Kelp Forest Snorkel Tours',
  'Saltmarsh Boardwalk Reserve',
  'Gannet Point Lighthouse Viewpoint',
  'Old Customs House Restaurant',
  'Tidepool Discovery Centre',
]

let cached: Promise<TripView> | null = null

export function sampleGuide(config: Config): Promise<TripView> {
  cached ??= build(config).catch((err) => {
    cached = null
    throw err
  })
  return cached
}

async function build(config: Config): Promise<TripView> {
  const service = new TripService({
    config,
    store: new MemoryStore(),
    places: new DemoPlacesProvider(),
    ai: null,
    payments: null,
    safety: new NoSafetyProvider(),
    now: () => new Date('2026-10-01T09:00:00Z'),
  })
  let trip = await service.createTrip('0'.repeat(64), {
    provider: 'demo',
    providerPlaceId: 'demo-acc-kestrel-resort',
  })
  trip = await service.confirmAccommodation(trip, false)
  trip = await service.setPreferences(trip, {
    checkIn: '2026-12-10',
    checkOut: '2026-12-13',
    adults: 2,
    childAgeRanges: ['6-12'],
    tripType: 'family',
    budget: { amount: 400, currency: 'USD' },
    transport: 'rental_car',
    interests: ['beaches', 'wildlife', 'history', 'food'],
    pace: 'balanced',
    accessibilityNeeds: null,
    dietaryPreferences: null,
    settingPreference: 'no_preference',
    language: 'en',
  })
  trip = await service.discover(trip)
  const view = await service.view(trip)
  for (const p of view.places) {
    if (SAMPLE_PICKS.includes(p.name))
      await service.setSelection(trip, p.id, { selected: true })
  }
  const { trip: planned } = await service.generate(trip, { useAi: false })
  const full = await service.view(planned)
  return {
    ...full,
    readOnly: true,
    entitlement: { fullGuide: true, reason: 'sample', lockedDays: 0 },
  }
}
