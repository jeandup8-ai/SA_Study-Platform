import { describe, expect, it } from 'vitest'
import { MAX_RADIUS_M, distanceMeters, isWithinRadius } from '../shared/geo.js'
import { DEMO_ACCOMMODATIONS, DEMO_PLACES } from '../server/providers/places/demo-data.js'
import { DemoPlacesProvider } from '../server/providers/places/demo.js'
import type { PlacesProvider } from '../server/providers/places/types.js'
import { placeIdFor } from '../server/service.js'
import { PREFS, client, readyTrip, setup } from './helpers.js'

describe('accommodation search', () => {
  it('rejects an empty or too-short query', async () => {
    const c = client(setup().app)
    expect((await c.post('/api/accommodation/search', { query: '' })).status).toBe(400)
    expect((await c.post('/api/accommodation/search', { query: ' a ' })).status).toBe(400)
  })

  it('returns labelled sample results', async () => {
    const c = client(setup().app)
    const r = await c.post('/api/accommodation/search', { query: 'kestrel resort' })
    expect(r.status).toBe(200)
    expect(r.data.isSample).toBe(true)
    expect(r.data.candidates.map((x: { name: string }) => x.name)).toEqual(['Kestrel Bay Beach Resort'])
  })

  it('disambiguates properties that share a name', async () => {
    const c = client(setup().app)
    const r = await c.post('/api/accommodation/search', { query: 'Harbour View Lodge' })
    expect(r.data.candidates).toHaveLength(2)
    const lines = r.data.candidates.map((x: { disambiguation: string }) => x.disambiguation)
    expect(new Set(lines).size).toBe(2)
    expect(lines.every(Boolean)).toBe(true)
  })

  it('returns 503 with a clear message when the provider is down', async () => {
    const broken: PlacesProvider = Object.assign(new DemoPlacesProvider(), {
      searchAccommodation: async () => {
        throw new Error('boom')
      },
    })
    const c = client(setup({ places: broken }).app)
    const r = await c.post('/api/accommodation/search', { query: 'kestrel' })
    expect(r.status).toBe(503)
    expect(r.data.error.code).toBe('places_unavailable')
  })
})

describe('trip creation and confirmation', () => {
  it('takes coordinates from the provider, not the browser', async () => {
    const c = client(setup().app)
    const r = await c.post('/api/trips', { provider: 'demo', providerPlaceId: 'demo-acc-kestrel-resort', location: { lat: 0, lng: 0 } })
    expect(r.status).toBe(201)
    expect(r.data.accommodation.location).toEqual(DEMO_ACCOMMODATIONS[0]!.location)
    expect(r.data.accommodation.confirmed).toBe(false)
  })

  it('refuses discovery before the location is confirmed', async () => {
    const c = client(setup().app)
    const { data } = await c.post('/api/trips', { provider: 'demo', providerPlaceId: 'demo-acc-kestrel-resort' })
    const r = await c.post(`/api/trips/${data.id}/discover`, {})
    expect(r.status).toBe(409)
    expect(r.data.error.code).toBe('accommodation_unconfirmed')
  })

  it('requires explicit acknowledgement for a town-centre location', async () => {
    const c = client(setup().app)
    const { data } = await c.post('/api/trips', { provider: 'demo', providerPlaceId: 'demo-area-kestrel' })
    const refused = await c.post(`/api/trips/${data.id}/accommodation/confirm`, {})
    expect(refused.status).toBe(422)
    expect(refused.data.error.code).toBe('area_centre_unacknowledged')
    const ok = await c.post(`/api/trips/${data.id}/accommodation/confirm`, { acknowledgeAreaCentre: true })
    expect(ok.data.accommodation.confirmed).toBe(true)
  })

  it('rejects an unknown property id', async () => {
    const c = client(setup().app)
    expect((await c.post('/api/trips', { provider: 'demo', providerPlaceId: 'nope' })).status).toBe(404)
  })
})

describe('access control', () => {
  it('hides a trip from other browsers and from unauthenticated requests', async () => {
    const { app } = setup()
    const owner = client(app)
    const { id } = await readyTrip(owner)
    const stranger = client(app)
    await stranger.post('/api/accommodation/search', { query: 'kestrel' }) // has no cookie yet
    expect((await stranger.get(`/api/trips/${id}`)).status).toBe(404)
    await stranger.post('/api/trips', { provider: 'demo', providerPlaceId: 'demo-acc-kestrel-resort' }) // now has its own cookie
    for (const r of [
      await stranger.get(`/api/trips/${id}`),
      await stranger.put(`/api/trips/${id}/preferences`, PREFS),
      await stranger.post(`/api/trips/${id}/itinerary`, {}),
      await stranger.get(`/api/trips/${id}/guide.pdf`),
      await stranger.del(`/api/trips/${id}`),
    ]) {
      expect(r.status).toBe(404)
    }
    expect((await owner.get(`/api/trips/${id}`)).status).toBe(200)
    const list = await stranger.get('/api/trips')
    expect(list.data.trips.map((t: { id: string }) => t.id)).not.toContain(id)
  })

  it('rejects a forged owner cookie and malformed ids', async () => {
    const { app } = setup()
    const { id } = await readyTrip(client(app))
    const res = await app.request(`http://localhost/api/trips/${id}`, { headers: { Cookie: 'ss_owner=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' } })
    expect(res.status).toBe(404)
    const c = client(app)
    expect((await c.get('/api/trips/not-a-uuid')).status).toBe(404)
  })

  it('refuses cross-site writes', async () => {
    const c = client(setup().app)
    const r = await c.post('/api/accommodation/search', { query: 'kestrel' }, { Origin: 'https://evil.example' })
    expect(r.status).toBe(403)
  })
})

describe('preferences validation', () => {
  it('rejects check-out before check-in, zero nights and over-long trips', async () => {
    const c = client(setup().app)
    const { data } = await c.post('/api/trips', { provider: 'demo', providerPlaceId: 'demo-acc-kestrel-resort' })
    for (const bad of [
      { ...PREFS, checkOut: '2026-12-09' },
      { ...PREFS, checkOut: PREFS.checkIn },
      { ...PREFS, checkOut: '2027-02-10' },
      { ...PREFS, checkIn: '2026-02-30' },
      { ...PREFS, adults: 0 },
    ]) {
      const r = await c.put(`/api/trips/${data.id}/preferences`, bad)
      expect(r.status).toBe(400)
    }
    expect((await c.put(`/api/trips/${data.id}/preferences`, PREFS)).status).toBe(200)
  })
})

describe('50 km radius enforcement', () => {
  it('keeps only places within 50 km and reports what was rejected', async () => {
    const c = client(setup().app)
    const { view } = await readyTrip(c)
    const origin = view.accommodation.location
    expect(view.places.length).toBeGreaterThan(10)
    for (const p of view.places) {
      expect(isWithinRadius(origin, p.location)).toBe(true)
      expect(p.distanceMeters).toBeLessThanOrEqual(MAX_RADIUS_M)
      expect(p.distanceMeters).toBeCloseTo(distanceMeters(origin, p.location), 3)
    }
    const names = view.places.map((p: { name: string }) => p.name)
    expect(names).not.toContain('Glass Lake National Reserve') // 63 km
    expect(names).not.toContain('Cape Farewell Lighthouse') // 52 km
    expect(names).not.toContain('Hidden Falls (location unconfirmed)') // no coordinates
    expect(view.discovery.rejectedReasons).toMatchObject({ missing_coordinates: 1 })
    expect(view.discovery.rejectedReasons.outside_radius).toBeGreaterThanOrEqual(2)
  })

  it('ignores a radius sent by the client', async () => {
    const c = client(setup().app)
    const { id } = await readyTrip(c)
    const r = await c.post(`/api/trips/${id}/discover`, { radiusMeters: 500_000, radius: 500_000 })
    expect(r.status).toBe(200)
    expect(r.data.places.every((p: { distanceMeters: number }) => p.distanceMeters <= MAX_RADIUS_M)).toBe(true)
  })

  it('applies the rule after merging results from a provider that returns duplicates and junk', async () => {
    const out = DEMO_PLACES.find((p) => p.providerPlaceId === 'demo-glass-lake')!
    const messy: PlacesProvider = Object.assign(new DemoPlacesProvider(), {
      searchNearby: async () => [...structuredClone(DEMO_PLACES), ...structuredClone(DEMO_PLACES), { ...out, providerPlaceId: 'dup-out', location: { lat: 'x', lng: 1 } }, { ...out, providerPlaceId: 'evil', location: { lat: -32.4, lng: -19 } }],
    })
    const c = client(setup({ places: messy }).app)
    const { view } = await readyTrip(c)
    const ids = view.places.map((p: { id: string }) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const p of view.places) expect(isWithinRadius(view.accommodation.location, p.location)).toBe(true)
  })

  it('explains honestly when few places are in range, without widening the radius', async () => {
    const c = client(setup().app)
    const { view } = await readyTrip(c, 'demo-acc-harbour-marrow')
    expect(view.places).toHaveLength(2)
    expect(view.discovery.note).toMatch(/Only 2 places/)
    expect(view.discovery.note).toMatch(/do not widen/)
  })

  it('removes out-of-range activities when the accommodation changes', async () => {
    const c = client(setup().app)
    const { id, view } = await readyTrip(c)
    for (const p of view.places.slice(0, 8)) await c.put(`/api/trips/${id}/selections`, { placeId: p.id, selected: true })
    const gen = await c.post(`/api/trips/${id}/itinerary`, { useAi: false })
    expect(gen.status).toBe(200)
    expect(gen.data.itinerary.days.flatMap((d: { items: unknown[] }) => d.items).length).toBeGreaterThan(0)

    const moved = await c.put(`/api/trips/${id}/accommodation`, { provider: 'demo', providerPlaceId: 'demo-acc-harbour-marrow' })
    expect(moved.status).toBe(200)
    expect(moved.data.removedPlaces.length).toBeGreaterThan(5)
    expect(moved.data.removedFromPlan).toBeGreaterThan(0)
    const t = moved.data.trip
    expect(t.accommodation.confirmed).toBe(false)
    const origin = t.accommodation.location
    for (const p of t.places) expect(isWithinRadius(origin, p.location)).toBe(true)
    const placeIds = new Set(t.places.map((p: { id: string }) => p.id))
    for (const item of t.itinerary.days.flatMap((d: { items: Array<{ placeId: string | null }> }) => d.items)) {
      if (item.placeId) expect(placeIds.has(item.placeId)).toBe(true)
    }
    expect(t.itinerary.warnings.join(' ')).toMatch(/more than 50 km away/)
    // Export is blocked until the new stay is confirmed and the plan revalidates.
    expect((await c.get(`/api/trips/${id}/guide.pdf`)).status).toBe(422)
  })
})

describe('itinerary generation and editing', () => {
  it('builds a valid day-by-day plan from selected places', async () => {
    const c = client(setup().app)
    const { id, view } = await readyTrip(c)
    const museum = view.places.find((p: { name: string }) => p.name === 'Kestrel Bay Maritime Museum')
    await c.put(`/api/trips/${id}/selections`, { placeId: museum.id, selected: true, favourite: true })
    const r = await c.post(`/api/trips/${id}/itinerary`, { useAi: false })
    expect(r.status).toBe(200)
    const itin = r.data.itinerary
    expect(itin.days.map((d: { date: string }) => d.date)).toEqual(['2026-12-10', '2026-12-11', '2026-12-12', '2026-12-13', '2026-12-14'])
    expect(r.data.issues.filter((i: { severity: string }) => i.severity === 'error')).toEqual([])
    const all = itin.days.flatMap((d: { items: Array<{ placeId: string; kind: string }> }) => d.items)
    expect(all.some((i: { placeId: string }) => i.placeId === museum.id)).toBe(true)
    const activities = all.filter((i: { kind: string }) => i.kind === 'activity').map((i: { placeId: string }) => i.placeId)
    expect(new Set(activities).size).toBe(activities.length)
    for (const d of itin.days) expect(d.items.filter((i: { kind: string }) => i.kind === 'activity').length).toBeLessThanOrEqual(2)
    // Arrival day starts no earlier than mid-afternoon.
    expect(itin.days[0].items.every((i: { startTime: string }) => i.startTime >= '15:00')).toBe(true)
  })

  it('does not schedule the museum on Monday, when it is listed as closed', async () => {
    const c = client(setup().app)
    // 2026-12-14 is a Monday.
    const { id, view } = await readyTrip(c, 'demo-acc-kestrel-resort', { ...PREFS, checkIn: '2026-12-13', checkOut: '2026-12-16' })
    const museum = view.places.find((p: { name: string }) => p.name === 'Kestrel Bay Maritime Museum')
    await c.put(`/api/trips/${id}/selections`, { placeId: museum.id, selected: true })
    const r = await c.post(`/api/trips/${id}/itinerary`, { useAi: false })
    const monday = r.data.itinerary.days.find((d: { date: string }) => d.date === '2026-12-14')
    expect(monday.items.some((i: { placeId: string }) => i.placeId === museum.id)).toBe(false)

    // Forcing it onto Monday by edit is refused.
    const edit = {
      version: r.data.itinerary.version,
      days: r.data.itinerary.days.map((d: { date: string; items: unknown[] }) => ({
        date: d.date,
        items: d.date === '2026-12-14' ? [{ id: 'x1', slot: 'morning', kind: 'activity', placeId: museum.id, startTime: '10:00', durationMinutes: 120 }] : (d.items as Array<Record<string, unknown>>).filter((i) => i.placeId !== museum.id),
      })),
    }
    const refused = await c.put(`/api/trips/${id}/itinerary`, edit)
    expect(refused.status).toBe(422)
    expect(refused.data.error.details.map((i: { code: string }) => i.code)).toContain('closed')
  })

  it('refuses to save an edit that references an out-of-radius or invented place', async () => {
    const c = client(setup().app)
    const { id } = await readyTrip(c)
    const gen = await c.post(`/api/trips/${id}/itinerary`, { useAi: false })
    const itin = gen.data.itinerary
    const outside = placeIdFor('demo', 'demo-glass-lake')
    for (const placeId of [outside, 'p_made_up_by_ai']) {
      const edit = {
        version: itin.version,
        days: itin.days.map((d: { date: string; items: unknown[] }, i: number) => ({
          date: d.date,
          items: i === 1 ? [{ id: 'z', slot: 'morning', kind: 'activity', placeId, startTime: '09:30', durationMinutes: 120 }] : d.items,
        })),
      }
      const r = await c.put(`/api/trips/${id}/itinerary`, edit)
      expect(r.status).toBe(422)
      expect(r.data.error.details.map((x: { code: string }) => x.code)).toContain('unknown_place')
    }
    const after = await c.get(`/api/trips/${id}`)
    expect(after.data.itinerary.version).toBe(itin.version)
  })

  it('rejects overlapping, duplicate and out-of-range-date edits; accepts a valid reorder', async () => {
    const c = client(setup().app)
    const { id, view } = await readyTrip(c)
    const gen = await c.post(`/api/trips/${id}/itinerary`, { useAi: false })
    const itin = gen.data.itinerary
    const [a, b] = view.places.filter((p: { category: string }) => p.category === 'beach' || p.category === 'nature')
    const day = (items: unknown[], date = itin.days[1].date) => ({ version: itin.version, days: [{ date, items }] })
    const overlap = await c.put(`/api/trips/${id}/itinerary`, day([
      { id: '1', slot: 'morning', kind: 'activity', placeId: a.id, startTime: '10:00', durationMinutes: 120 },
      { id: '2', slot: 'morning', kind: 'activity', placeId: b.id, startTime: '10:30', durationMinutes: 60 },
    ]))
    expect(overlap.data.error.details.map((x: { code: string }) => x.code)).toContain('overlap')
    const dup = await c.put(`/api/trips/${id}/itinerary`, {
      version: itin.version,
      days: [
        { date: itin.days[1].date, items: [{ id: '1', slot: 'morning', kind: 'activity', placeId: a.id, startTime: '10:00', durationMinutes: 60 }] },
        { date: itin.days[2].date, items: [{ id: '2', slot: 'morning', kind: 'activity', placeId: a.id, startTime: '10:00', durationMinutes: 60 }] },
      ],
    })
    expect(dup.data.error.details.map((x: { code: string }) => x.code)).toContain('duplicate_activity')
    const badDate = await c.put(`/api/trips/${id}/itinerary`, day([], '2027-01-01'))
    expect(badDate.data.error.details.map((x: { code: string }) => x.code)).toContain('date_out_of_range')

    const ok = await c.put(`/api/trips/${id}/itinerary`, day([{ id: '1', slot: 'afternoon', kind: 'activity', placeId: a.id, startTime: '14:00', durationMinutes: 90 }]))
    expect(ok.status).toBe(200)
    expect(ok.data.itinerary.version).toBe(itin.version + 1)
    // Stale version → conflict.
    expect((await c.put(`/api/trips/${id}/itinerary`, day([]))).status).toBe(409)
  })

  it('regenerates one day without touching the others', async () => {
    const c = client(setup().app)
    const { id } = await readyTrip(c)
    const gen = await c.post(`/api/trips/${id}/itinerary`, { useAi: false })
    const before = gen.data.itinerary.days
    const r = await c.post(`/api/trips/${id}/itinerary/days/2/regenerate`, {})
    expect(r.status).toBe(200)
    const after = r.data.itinerary.days
    for (const i of [0, 1, 3, 4]) expect(after[i].items).toEqual(before[i].items)
    const used = after.flatMap((d: { items: Array<{ kind: string; placeId: string }> }) => d.items.filter((x) => x.kind === 'activity').map((x) => x.placeId))
    expect(new Set(used).size).toBe(used.length)
  })

  it('labels missing opening hours as unconfirmed rather than inventing them', async () => {
    const c = client(setup().app)
    const { id, view } = await readyTrip(c)
    const beach = view.places.find((p: { name: string }) => p.name === 'Kestrel Bay Main Beach')
    expect(beach.openingHours).toBeNull()
    await c.put(`/api/trips/${id}/selections`, { placeId: beach.id, selected: true, favourite: true })
    const r = await c.post(`/api/trips/${id}/itinerary`, { useAi: false })
    const item = r.data.itinerary.days.flatMap((d: { items: unknown[] }) => d.items).find((i: { placeId: string }) => i.placeId === beach.id)
    expect(item.notes.join(' ')).toMatch(/Opening hours not confirmed/)
    expect(r.data.issues.some((i: { code: string; placeId: string }) => i.code === 'hours_unknown' && i.placeId === beach.id)).toBe(true)
  })
})

describe('AI provider handling', () => {
  it('discards an AI plan with invented ids and falls back to the deterministic planner', async () => {
    const ai = { name: 'fake', proposePlan: async ({ dates }: { dates: string[] }) => dates.map((date) => ({ date, items: [{ slot: 'morning' as const, kind: 'activity' as const, placeId: 'p_invented', startTime: '10:00', durationMinutes: 60 }] })) }
    const c = client(setup({ ai }).app)
    const { id } = await readyTrip(c)
    const r = await c.post(`/api/trips/${id}/itinerary`, { useAi: true })
    expect(r.status).toBe(200)
    expect(r.data.itinerary.generatedBy).toBe('deterministic')
    expect(r.data.itinerary.warnings.join(' ')).toMatch(/not in your results/)
  })

  it('cannot persist an AI plan that uses an out-of-radius place, even with a real id', async () => {
    const outside = placeIdFor('demo', 'demo-glass-lake')
    const ai = { name: 'fake', proposePlan: async ({ dates }: { dates: string[] }) => [{ date: dates[1]!, items: [{ slot: 'morning' as const, kind: 'activity' as const, placeId: outside, startTime: '10:00', durationMinutes: 60 }] }] }
    const c = client(setup({ ai }).app)
    const { id } = await readyTrip(c)
    const r = await c.post(`/api/trips/${id}/itinerary`, { useAi: true })
    expect(r.data.itinerary.generatedBy).toBe('deterministic')
    const ids = r.data.itinerary.days.flatMap((d: { items: Array<{ placeId: string }> }) => d.items.map((i) => i.placeId))
    expect(ids).not.toContain(outside)
  })

  it('accepts a valid AI plan', async () => {
    let captured: { places: Array<{ id: string; name: string }> } | null = null
    const ai = {
      name: 'fake',
      proposePlan: async (input: { dates: string[]; places: Array<{ id: string; name: string }> }) => {
        captured = input
        const beach = input.places.find((p) => p.name === 'Kestrel Bay Main Beach')!
        return input.dates.map((date, i) => ({ date, items: i === 1 ? [{ slot: 'morning' as const, kind: 'activity' as const, placeId: beach.id, startTime: '10:00', durationMinutes: 120 }] : [] }))
      },
    }
    const c = client(setup({ ai }).app)
    const { id } = await readyTrip(c)
    const r = await c.post(`/api/trips/${id}/itinerary`, { useAi: true })
    expect(r.data.itinerary.generatedBy).toBe('ai')
    // Only validated, in-range places were offered to the model.
    expect(captured!.places.every((p) => !['Glass Lake National Reserve', 'Cape Farewell Lighthouse'].includes(p.name))).toBe(true)
  })

  it('falls back when the AI provider throws (timeout, rate limit, outage)', async () => {
    const ai = { name: 'fake', proposePlan: async () => { throw new Error('timeout') } }
    const c = client(setup({ ai }).app)
    const { id } = await readyTrip(c)
    const r = await c.post(`/api/trips/${id}/itinerary`, { useAi: true })
    expect(r.status).toBe(200)
    expect(r.data.itinerary.generatedBy).toBe('deterministic')
    expect(r.data.itinerary.warnings.join(' ')).toMatch(/unavailable/)
  })
})

describe('safety panel', () => {
  it('says plainly that safety information was not checked when no source is configured', async () => {
    const c = client(setup().app)
    const { id } = await readyTrip(c)
    const r = await c.get(`/api/trips/${id}/safety`)
    expect(r.status).toBe(200)
    expect(r.data.entries[0].status).toBe('not_checked')
    expect(r.data.officialLinks.length).toBeGreaterThan(0)
    expect(r.data.disclaimer).toMatch(/not evidence that a place or activity is safe/)
    expect(JSON.stringify(r.data)).not.toMatch(/score/i)
  })
})

describe('sharing', () => {
  it('serves a read-only view by unguessable token, and can be revoked', async () => {
    const { app } = setup()
    const c = client(app)
    const { id } = await readyTrip(c)
    await c.post(`/api/trips/${id}/itinerary`, { useAi: false })
    const { data } = await c.post(`/api/trips/${id}/share`, {})
    expect(data.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    const anon = client(app)
    const shared = await anon.get(`/api/shared/${data.token}`)
    expect(shared.status).toBe(200)
    expect(shared.data.readOnly).toBe(true)
    expect(shared.data.preferences).toBeNull()
    expect(shared.headers.get('x-robots-tag')).toBe('noindex')
    await c.del(`/api/trips/${id}/share`)
    expect((await anon.get(`/api/shared/${data.token}`)).status).toBe(404)
    expect((await anon.get('/api/shared/short')).status).toBe(404)
  })
})

describe('PDF export', () => {
  it('produces a PDF from the saved, validated plan', async () => {
    const c = client(setup().app)
    const { id } = await readyTrip(c)
    expect((await c.get(`/api/trips/${id}/guide.pdf`)).status).toBe(409) // no plan yet
    await c.post(`/api/trips/${id}/itinerary`, { useAi: false })
    const r = await c.get(`/api/trips/${id}/guide.pdf`)
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toBe('application/pdf')
    expect((r.data as Buffer).subarray(0, 5).toString()).toBe('%PDF-')
    expect((r.data as Buffer).length).toBeGreaterThan(3000)
  })
})

describe('sample guide', () => {
  it('is built from sample data and labelled as such', async () => {
    const c = client(setup().app)
    const r = await c.get('/api/sample')
    expect(r.status).toBe(200)
    expect(r.data.accommodation.isSample).toBe(true)
    expect(r.data.places.every((p: { isSample: boolean }) => p.isSample)).toBe(true)
    expect(r.data.itinerary.days.length).toBe(4)
    expect(r.data.issues.filter((i: { severity: string }) => i.severity === 'error')).toEqual([])
  })
})
