// Runs the full API flow against a real Postgres when TEST_DATABASE_URL is set.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PostgresStore } from '../server/store/postgres.js'
import { client, readyTrip, setup } from './helpers.js'

const url = process.env.TEST_DATABASE_URL

describe.skipIf(!url)('PostgresStore', () => {
  let store: PostgresStore

  beforeAll(async () => {
    store = new PostgresStore(url!, false)
    await store.pool.query(
      'drop table if exists orders, trip_places, trips, schema_migrations cascade',
    )
    expect(await store.migrate()).toEqual([
      '001_init',
      '002_keep_orders_add_refunded',
      '003_order_waiver_acknowledgement',
    ])
    expect(await store.migrate()).toEqual([]) // idempotent
  })
  afterAll(async () => {
    await store?.close()
  })

  it('persists a full trip journey with selections, plan, share link and cascade delete', async () => {
    const { app } = setup({ store })
    const c = client(app)
    const { id, view } = await readyTrip(c)
    expect(view.places.length).toBeGreaterThan(10)
    const target = view.places[0]
    await c.put(`/api/trips/${id}/selections`, {
      placeId: target.id,
      selected: true,
      favourite: true,
    })
    // Re-running discovery keeps the selection for places that remain.
    const again = await c.post(`/api/trips/${id}/discover`, {})
    expect(
      again.data.places.find((p: { id: string }) => p.id === target.id),
    ).toMatchObject({ selected: true, favourite: true })
    const gen = await c.post(`/api/trips/${id}/itinerary`, { useAi: false })
    expect(gen.status).toBe(200)
    const share = await c.post(`/api/trips/${id}/share`, {})
    expect((await client(app).get(`/api/shared/${share.data.token}`)).status).toBe(200)

    const moved = await c.put(`/api/trips/${id}/accommodation`, {
      provider: 'demo',
      providerPlaceId: 'demo-acc-harbour-marrow',
    })
    expect(moved.data.trip.places).toHaveLength(0) // nothing from Kestrel Bay is within 50 km of Marrow Point
    const { rows } = await store.pool.query(
      'select count(*)::int as n from trip_places where trip_id = $1',
      [id],
    )
    expect(rows[0].n).toBe(0)

    expect((await c.del(`/api/trips/${id}`)).status).toBe(204)
    expect(await store.getTrip(id)).toBeNull()
  })

  it('never moves a paid order back, and enforces unique provider order ids', async () => {
    const { app } = setup({ store })
    const { id } = await readyTrip(client(app))
    const now = new Date().toISOString()
    const row = {
      id: crypto.randomUUID(),
      tripId: id,
      provider: 'paypal',
      providerOrderId: 'PGTEST1',
      amount: '9.00',
      currency: 'USD',
      status: 'created' as const,
      captureId: null,
      waiverAcknowledgedAt: null,
      createdAt: now,
      updatedAt: now,
    }
    await store.createOrder(row)
    await expect(store.createOrder({ ...row, id: crypto.randomUUID() })).rejects.toThrow()
    expect((await store.updateOrder(row.id, 'paid', 'CAPX', now))!.status).toBe('paid')
    expect((await store.updateOrder(row.id, 'failed', null, now))!.status).toBe('paid')
    expect(await store.hasPaidOrder(id)).toBe(true)
    // paid → refunded is allowed, and refunded is final.
    expect((await store.updateOrder(row.id, 'refunded', null, now))!.status).toBe(
      'refunded',
    )
    expect((await store.updateOrder(row.id, 'paid', null, now))!.status).toBe('refunded')
    expect(await store.hasPaidOrder(id)).toBe(false)
    // Deleting the trip keeps the order, detached.
    await store.deleteTrip(id)
    expect(await store.getOrderByProviderId('paypal', 'PGTEST1')).toMatchObject({
      tripId: null,
      captureId: 'CAPX',
    })
  })

  it('saves an itinerary only when the stored version matches', async () => {
    const { app } = setup({ store })
    const c = client(app)
    const { id } = await readyTrip(c)
    const gen = await c.post(`/api/trips/${id}/itinerary`, { useAi: false })
    const v = gen.data.itinerary.version
    const trip = (await store.getTrip(id))!
    const now = new Date().toISOString()
    const next = { ...trip.itinerary!, version: v + 1 }
    expect(await store.saveItinerary(id, next, v, now)).not.toBeNull()
    expect(await store.saveItinerary(id, { ...next, version: v + 2 }, v, now)).toBeNull()
  })

  it('retention deletes only trips untouched since the cutoff', async () => {
    const { app } = setup({ store })
    const { id } = await readyTrip(client(app))
    expect(await store.deleteInactiveTrips('2000-01-01T00:00:00Z')).toBe(0)
    expect(await store.getTrip(id)).not.toBeNull()
    await store.deleteInactiveTrips(new Date(Date.now() + 1000).toISOString())
    expect(await store.getTrip(id)).toBeNull()
  })
})
