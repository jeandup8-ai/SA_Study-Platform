import { describe, expect, it } from 'vitest'
import type { OrderSnapshot, PaymentProvider } from '../server/providers/payments.js'
import { client, readyTrip, setup } from './helpers.js'

/** A scripted payment provider; captureOrder returns whatever the test sets. */
function fakePayments() {
  let n = 0
  const state = {
    capture: null as null | ((orderId: string) => OrderSnapshot),
    captureCalls: 0,
    tripByOrder: new Map<string, string>(),
    /** What GET /v2/checkout/orders/{id} returns; defaults to the capture result. */
    order: null as null | ((orderId: string) => OrderSnapshot),
    webhookValid: true,
  }
  const provider: PaymentProvider = {
    name: 'paypal',
    mode: 'sandbox',
    clientId: 'public-client-id',
    async createOrder({ tripId }) {
      const orderId = `ORDER${++n}AAAA`
      state.tripByOrder.set(orderId, tripId)
      return {
        orderId,
        orderStatus: 'CREATED',
        captureId: null,
        captureStatus: null,
        amount: '9.00',
        currency: 'USD',
        customId: tripId,
      }
    },
    async captureOrder(orderId) {
      state.captureCalls++
      return state.capture!(orderId)
    },
    async getOrder(orderId) {
      return (state.order ?? state.capture)!(orderId)
    },
    async verifyWebhook() {
      return state.webhookValid
    },
  }
  const completed = (
    orderId: string,
    over: Partial<OrderSnapshot> = {},
  ): OrderSnapshot => ({
    orderId,
    orderStatus: 'COMPLETED',
    captureId: `CAP-${orderId}`,
    captureStatus: 'COMPLETED',
    amount: '9.00',
    currency: 'USD',
    customId: state.tripByOrder.get(orderId)!,
    ...over,
  })
  return { provider, state, completed }
}

async function generatedTrip(c: ReturnType<typeof client>) {
  const { id } = await readyTrip(c)
  await c.post(`/api/trips/${id}/itinerary`, { useAi: false })
  return id
}

describe('payments', () => {
  it('without a payment provider, the whole guide is available and labelled as such', async () => {
    const c = client(setup().app)
    const id = await generatedTrip(c)
    const v = await c.get(`/api/trips/${id}`)
    expect(v.data.entitlement).toEqual({
      fullGuide: true,
      reason: 'payments_not_configured',
      lockedDays: 0,
    })
    expect((await c.post(`/api/trips/${id}/checkout`, {})).status).toBe(409)
  })

  it('with payments on, the server withholds later days and the PDF until paid', async () => {
    const { provider } = fakePayments()
    const c = client(setup({ payments: provider }).app)
    const id = await generatedTrip(c)
    const v = await c.get(`/api/trips/${id}`)
    expect(v.data.entitlement.fullGuide).toBe(false)
    expect(v.data.itinerary.days).toHaveLength(1)
    expect(v.data.entitlement.lockedDays).toBe(4)
    expect((await c.get(`/api/trips/${id}/guide.pdf`)).status).toBe(402)
  })

  it('a visit to a "success" URL or a client claim does not unlock anything', async () => {
    const { provider } = fakePayments()
    const c = client(setup({ payments: provider }).app)
    const id = await generatedTrip(c)
    await c.get(`/api/trips/${id}?paid=true&status=COMPLETED`)
    await c.put(`/api/trips/${id}/preferences`, { paid: true })
    expect((await c.get(`/api/trips/${id}`)).data.entitlement.fullGuide).toBe(false)
  })

  it('cancelled checkout (never approved) leaves the guide locked', async () => {
    const { provider, state } = fakePayments()
    state.capture = (orderId) => ({
      orderId,
      orderStatus: 'CREATED',
      captureId: null,
      captureStatus: null,
      amount: '9.00',
      currency: 'USD',
      customId: null,
    })
    const c = client(setup({ payments: provider }).app)
    const id = await generatedTrip(c)
    const { data } = await c.post(`/api/trips/${id}/checkout`, {})
    const r = await c.post(`/api/trips/${id}/checkout/capture`, { orderId: data.orderId })
    expect(r.data.status).toBe('awaiting_approval')
    expect((await c.get(`/api/trips/${id}`)).data.entitlement.fullGuide).toBe(false)
  })

  it('a verified capture unlocks the guide; duplicate callbacks are idempotent', async () => {
    const { provider, state, completed } = fakePayments()
    state.capture = (orderId) => completed(orderId)
    const c = client(setup({ payments: provider }).app)
    const id = await generatedTrip(c)
    const { data } = await c.post(`/api/trips/${id}/checkout`, {})
    const results = await Promise.all(
      [1, 2, 3].map(() =>
        c.post(`/api/trips/${id}/checkout/capture`, { orderId: data.orderId }),
      ),
    )
    expect(results.map((r) => r.data.status)).toEqual(['paid', 'paid', 'paid'])
    const again = await c.post(`/api/trips/${id}/checkout/capture`, {
      orderId: data.orderId,
    })
    expect(again.data.status).toBe('paid')
    expect(state.captureCalls).toBeLessThanOrEqual(3) // later calls short-circuit on our own record
    const v = await c.get(`/api/trips/${id}`)
    expect(v.data.entitlement).toMatchObject({ fullGuide: true, reason: 'paid' })
    expect(v.data.itinerary.days).toHaveLength(5)
    expect((await c.get(`/api/trips/${id}/guide.pdf`)).status).toBe(200)
    expect((await c.post(`/api/trips/${id}/checkout`, {})).status).toBe(409)
  })

  it('a wrong amount, currency or guide id does not unlock', async () => {
    for (const over of [
      { amount: '0.01' },
      { currency: 'EUR' },
      { customId: 'someone-else' },
    ]) {
      const { provider, state, completed } = fakePayments()
      state.capture = (orderId) => completed(orderId, over)
      const c = client(setup({ payments: provider }).app)
      const id = await generatedTrip(c)
      const { data } = await c.post(`/api/trips/${id}/checkout`, {})
      const r = await c.post(`/api/trips/${id}/checkout/capture`, {
        orderId: data.orderId,
      })
      expect(r.data.status).toBe('failed')
      expect((await c.get(`/api/trips/${id}`)).data.entitlement.fullGuide).toBe(false)
    }
  })

  it('pending and declined captures do not unlock', async () => {
    for (const captureStatus of ['PENDING', 'DECLINED']) {
      const { provider, state, completed } = fakePayments()
      state.capture = (orderId) => completed(orderId, { captureStatus })
      const c = client(setup({ payments: provider }).app)
      const id = await generatedTrip(c)
      const { data } = await c.post(`/api/trips/${id}/checkout`, {})
      const r = await c.post(`/api/trips/${id}/checkout/capture`, {
        orderId: data.orderId,
      })
      expect(r.data.status).toBe(captureStatus === 'PENDING' ? 'pending' : 'failed')
      expect((await c.get(`/api/trips/${id}`)).data.entitlement.fullGuide).toBe(false)
    }
  })

  it("cannot capture another trip's order", async () => {
    const { provider, state, completed } = fakePayments()
    state.capture = (orderId) => completed(orderId)
    const { app } = setup({ payments: provider })
    const a = client(app)
    const b = client(app)
    const idA = await generatedTrip(a)
    const idB = await generatedTrip(b)
    const { data } = await a.post(`/api/trips/${idA}/checkout`, {})
    const r = await b.post(`/api/trips/${idB}/checkout/capture`, {
      orderId: data.orderId,
    })
    expect(r.status).toBe(404)
    expect(state.captureCalls).toBe(0)
  })

  it('payment provider outage reports clearly and charges nothing', async () => {
    const { provider } = fakePayments()
    provider.createOrder = async () => {
      throw new Error('down')
    }
    const c = client(setup({ payments: provider }).app)
    const id = await generatedTrip(c)
    const r = await c.post(`/api/trips/${id}/checkout`, {})
    expect(r.status).toBe(503)
    expect(r.data.error.message).toMatch(/not been charged/)
  })

  it('a capture PayPal held as pending unlocks once PayPal completes it', async () => {
    const { provider, state, completed } = fakePayments()
    state.capture = (orderId) => completed(orderId, { captureStatus: 'PENDING' })
    let clock = new Date('2026-12-01T10:00:00Z')
    const c = client(setup({ payments: provider, now: () => clock }).app)
    const id = await generatedTrip(c)
    const { data } = await c.post(`/api/trips/${id}/checkout`, {})
    expect(
      (await c.post(`/api/trips/${id}/checkout/capture`, { orderId: data.orderId })).data
        .status,
    ).toBe('pending')
    // PayPal completes it later; within a minute we don't re-ask.
    state.order = (orderId) => completed(orderId)
    expect((await c.get(`/api/trips/${id}`)).data.entitlement.fullGuide).toBe(false)
    clock = new Date(clock.getTime() + 61_000)
    expect((await c.get(`/api/trips/${id}`)).data.entitlement).toMatchObject({
      fullGuide: true,
      reason: 'paid',
    })
  })

  it('share links require the complete guide', async () => {
    const { provider } = fakePayments()
    const c = client(setup({ payments: provider }).app)
    const id = await generatedTrip(c)
    expect((await c.post(`/api/trips/${id}/share`, {})).status).toBe(402)
  })

  it('editing an unpaid preview keeps the locked days', async () => {
    const { provider } = fakePayments()
    const { app, store } = setup({ payments: provider })
    const c = client(app)
    const id = await generatedTrip(c)
    const before = (await store.getTrip(id))!.itinerary!
    const view = (await c.get(`/api/trips/${id}`)).data
    expect(view.itinerary.days).toHaveLength(1)
    const r = await c.put(`/api/trips/${id}/itinerary`, {
      version: view.itinerary.version,
      days: [{ date: view.itinerary.days[0].date, items: [] }],
    })
    expect(r.status).toBe(200)
    const after = (await store.getTrip(id))!.itinerary!
    expect(after.days).toHaveLength(before.days.length)
    expect(after.days.slice(1).map((d) => d.items.map((i) => i.placeId))).toEqual(
      before.days.slice(1).map((d) => d.items.map((i) => i.placeId)),
    )
  })

  it('deleting a trip keeps its order record (detached) for refunds', async () => {
    const { provider, state, completed } = fakePayments()
    state.capture = (orderId) => completed(orderId)
    const { app, store } = setup({ payments: provider })
    const c = client(app)
    const id = await generatedTrip(c)
    const { data } = await c.post(`/api/trips/${id}/checkout`, {})
    await c.post(`/api/trips/${id}/checkout/capture`, { orderId: data.orderId })
    expect((await c.del(`/api/trips/${id}`)).status).toBe(204)
    const kept = await store.getOrderByProviderId('paypal', data.orderId)
    expect(kept).toMatchObject({
      tripId: null,
      status: 'paid',
      captureId: `CAP-${data.orderId}`,
    })
  })
})

describe('PayPal webhook', () => {
  const event = (type: string, orderId: string) => ({
    event_type: type,
    resource: type.startsWith('CHECKOUT.ORDER.')
      ? { id: orderId }
      : { id: 'CAP1', supplementary_data: { related_ids: { order_id: orderId } } },
  })
  const post = (app: ReturnType<typeof setup>['app'], body: unknown) =>
    app.request('http://localhost/api/webhooks/paypal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'paypal-auth-algo': 'SHA256withRSA',
        'paypal-cert-url': 'https://api.sandbox.paypal.com/cert',
        'paypal-transmission-id': 't1',
        'paypal-transmission-sig': 'sig',
        'paypal-transmission-time': '2026-12-01T10:00:00Z',
      },
      body: JSON.stringify(body),
    })

  async function pendingTrip(
    state: ReturnType<typeof fakePayments>['state'],
    completed: ReturnType<typeof fakePayments>['completed'],
    app: ReturnType<typeof setup>['app'],
  ) {
    state.capture = (orderId) => completed(orderId, { captureStatus: 'PENDING' })
    const c = client(app)
    const id = await generatedTrip(c)
    const { data } = await c.post(`/api/trips/${id}/checkout`, {})
    await c.post(`/api/trips/${id}/checkout/capture`, { orderId: data.orderId })
    return { c, id, orderId: data.orderId as string }
  }

  it('is off (404) unless PAYPAL_WEBHOOK_ID is configured', async () => {
    const { provider } = fakePayments()
    const { app } = setup({ payments: provider })
    expect(
      (await post(app, event('PAYMENT.CAPTURE.COMPLETED', 'ORDER1AAAA'))).status,
    ).toBe(404)
  })

  it('rejects an event whose signature PayPal does not confirm', async () => {
    const { provider, state, completed } = fakePayments()
    const { app } = setup({ payments: provider, config: { PAYPAL_WEBHOOK_ID: 'WH-1' } })
    const { c, id, orderId } = await pendingTrip(state, completed, app)
    state.webhookValid = false
    state.order = (o) => completed(o)
    expect((await post(app, event('PAYMENT.CAPTURE.COMPLETED', orderId))).status).toBe(
      400,
    )
    expect((await c.get(`/api/trips/${id}`)).data.entitlement.fullGuide).toBe(false)
  })

  it('unlocks on a verified completion, re-checked with PayPal', async () => {
    const { provider, state, completed } = fakePayments()
    const { app } = setup({ payments: provider, config: { PAYPAL_WEBHOOK_ID: 'WH-1' } })
    const { c, id, orderId } = await pendingTrip(state, completed, app)
    state.order = (o) => completed(o)
    const r = await post(app, event('PAYMENT.CAPTURE.COMPLETED', orderId))
    expect(await r.json()).toEqual({ handled: true, status: 'paid' })
    expect((await c.get(`/api/trips/${id}`)).data.entitlement.fullGuide).toBe(true)
  })

  it('ignores what the event claims: a "completed" event for an order PayPal says is pending unlocks nothing', async () => {
    const { provider, state, completed } = fakePayments()
    const { app } = setup({ payments: provider, config: { PAYPAL_WEBHOOK_ID: 'WH-1' } })
    const { c, id, orderId } = await pendingTrip(state, completed, app)
    const r = await post(app, event('PAYMENT.CAPTURE.COMPLETED', orderId))
    expect(await r.json()).toEqual({ handled: true, status: 'pending' })
    expect((await c.get(`/api/trips/${id}`)).data.entitlement.fullGuide).toBe(false)
  })

  it('a verified refund re-locks the guide', async () => {
    const { provider, state, completed } = fakePayments()
    const { app } = setup({ payments: provider, config: { PAYPAL_WEBHOOK_ID: 'WH-1' } })
    state.capture = (o) => completed(o)
    const c = client(app)
    const id = await generatedTrip(c)
    const { data } = await c.post(`/api/trips/${id}/checkout`, {})
    await c.post(`/api/trips/${id}/checkout/capture`, { orderId: data.orderId })
    expect((await c.get(`/api/trips/${id}`)).data.entitlement.fullGuide).toBe(true)
    state.order = (o) => completed(o, { captureStatus: 'REFUNDED' })
    await post(app, event('PAYMENT.CAPTURE.REFUNDED', data.orderId))
    expect((await c.get(`/api/trips/${id}`)).data.entitlement.fullGuide).toBe(false)
    // A late duplicate "completed" capture callback cannot undo the refund.
    state.capture = (o) => completed(o)
    const late = await c.post(`/api/trips/${id}/checkout/capture`, {
      orderId: data.orderId,
    })
    expect(late.data.status).toBe('failed')
    expect((await c.get(`/api/trips/${id}`)).data.entitlement.fullGuide).toBe(false)
  })

  it('ignores events for orders we do not know', async () => {
    const { provider } = fakePayments()
    const { app } = setup({ payments: provider, config: { PAYPAL_WEBHOOK_ID: 'WH-1' } })
    const r = await post(app, event('PAYMENT.CAPTURE.COMPLETED', 'UNKNOWN123'))
    expect(await r.json()).toEqual({ handled: false })
  })
})
