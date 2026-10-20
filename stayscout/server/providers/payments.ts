// Payments. The browser never tells us an order is paid: the server creates
// the order, captures it, and checks status, amount, currency and our own
// custom_id on PayPal's response before unlocking anything.
//
// PayPal Orders v2 (https://developer.paypal.com/api/rest/integration/orders-api):
//   POST /v1/oauth2/token                 client-credentials token
//   POST /v2/checkout/orders              create (intent CAPTURE)
//   POST /v2/checkout/orders/{id}/capture capture after buyer approval
//   GET  /v2/checkout/orders/{id}         details (used to reconcile)
// PayPal-Request-Id makes create and capture idempotent on PayPal's side.
//
// NOT LIVE-TESTED: the build environment could not reach PayPal. Covered by
// fixture tests; follow docs/PAYPAL_SANDBOX.md to verify end to end.

import { ProviderError, requestJson, type FetchLike } from './http.js'

export interface OrderSnapshot {
  orderId: string
  orderStatus: string // CREATED | SAVED | APPROVED | VOIDED | COMPLETED | PAYER_ACTION_REQUIRED
  captureId: string | null
  captureStatus: string | null // COMPLETED | PENDING | DECLINED | FAILED | REFUNDED | PARTIALLY_REFUNDED
  amount: string | null
  currency: string | null
  customId: string | null
}

export interface PaymentProvider {
  readonly name: string
  readonly mode: 'sandbox' | 'live'
  readonly clientId: string
  createOrder(input: {
    tripId: string
    amount: string
    currency: string
    requestId: string
    description: string
  }): Promise<OrderSnapshot>
  captureOrder(orderId: string, requestId: string): Promise<OrderSnapshot>
  getOrder(orderId: string): Promise<OrderSnapshot>
  /**
   * Asks the provider whether a webhook delivery is genuine. Returns false for
   * anything it can't confirm; never throws for a bad signature.
   */
  verifyWebhook(
    headers: Record<string, string | undefined>,
    event: unknown,
    webhookId: string,
  ): Promise<boolean>
}

export type PaymentOutcome =
  | { state: 'paid'; captureId: string }
  | { state: 'pending' }
  | { state: 'awaiting_approval' }
  | { state: 'failed'; reason: string }
  | { state: 'refunded' }
  | { state: 'mismatch'; reason: string }

/** The single place that decides whether money actually arrived. */
export function evaluateOrder(
  snap: OrderSnapshot,
  expected: { tripId: string; amount: string; currency: string },
): PaymentOutcome {
  if (snap.customId !== null && snap.customId !== expected.tripId) {
    return { state: 'mismatch', reason: 'Order belongs to a different guide' }
  }
  if (snap.captureStatus === 'COMPLETED') {
    if (!snap.captureId) return { state: 'failed', reason: 'Capture has no id' }
    if (snap.customId !== expected.tripId)
      return { state: 'mismatch', reason: 'Order is not linked to this guide' }
    if (snap.currency !== expected.currency || snap.amount !== expected.amount) {
      return {
        state: 'mismatch',
        reason: 'Captured amount or currency does not match the price',
      }
    }
    return { state: 'paid', captureId: snap.captureId }
  }
  if (snap.captureStatus === 'PENDING') return { state: 'pending' }
  if (snap.captureStatus && ['DECLINED', 'FAILED'].includes(snap.captureStatus)) {
    return { state: 'failed', reason: `Payment ${snap.captureStatus.toLowerCase()}` }
  }
  if (
    snap.captureStatus &&
    ['REFUNDED', 'PARTIALLY_REFUNDED'].includes(snap.captureStatus)
  ) {
    return { state: 'refunded' }
  }
  if (snap.orderStatus === 'VOIDED')
    return { state: 'failed', reason: 'Order was voided' }
  return { state: 'awaiting_approval' }
}

type Json = Record<string, unknown>
const obj = (v: unknown): Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Json) : {}
const first = (v: unknown): Json => obj(Array.isArray(v) ? v[0] : undefined)
const str = (v: unknown): string | null =>
  typeof v === 'string' && v.length <= 200 ? v : null

export function parseOrder(data: unknown): OrderSnapshot {
  const o = obj(data)
  const unit = first(o.purchase_units)
  const capture = first(obj(unit.payments).captures)
  const amount = obj(Object.keys(capture).length ? capture.amount : unit.amount)
  return {
    orderId: str(o.id) ?? '',
    orderStatus: str(o.status) ?? 'UNKNOWN',
    captureId: str(capture.id),
    captureStatus: str(capture.status),
    amount: str(amount.value),
    currency: str(amount.currency_code),
    customId: str(capture.custom_id) ?? str(unit.custom_id),
  }
}

export class PayPalProvider implements PaymentProvider {
  readonly name = 'paypal'
  readonly mode: 'sandbox' | 'live'
  readonly clientId: string
  private readonly secret: string
  private readonly base: string
  private readonly fetchImpl: FetchLike
  private token: { value: string; expiresAt: number } | null = null

  constructor(opts: {
    clientId: string
    secret: string
    mode: 'sandbox' | 'live'
    fetchImpl?: FetchLike
  }) {
    this.clientId = opts.clientId
    this.secret = opts.secret
    this.mode = opts.mode
    this.base =
      opts.mode === 'live'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com'
    this.fetchImpl = opts.fetchImpl ?? fetch
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value
    const { data } = await requestJson<Json>({
      provider: 'paypal',
      url: `${this.base}/v1/oauth2/token`,
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.secret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      rawBody: 'grant_type=client_credentials',
      fetchImpl: this.fetchImpl,
    })
    const value = str(data.access_token)
    const ttl = typeof data.expires_in === 'number' ? data.expires_in : 300
    if (!value)
      throw new ProviderError('paypal', 'no access token in response', null, false)
    this.token = { value, expiresAt: Date.now() + ttl * 1000 }
    return value
  }

  private async call(
    path: string,
    method: 'GET' | 'POST',
    requestId?: string,
    body?: unknown,
  ) {
    const token = await this.accessToken()
    const { data } = await requestJson<Json>({
      provider: 'paypal',
      url: `${this.base}${path}`,
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Prefer: 'return=representation',
        ...(requestId ? { 'PayPal-Request-Id': requestId } : {}),
      },
      body: method === 'POST' ? (body ?? {}) : undefined,
      fetchImpl: this.fetchImpl,
      timeoutMs: 15_000,
    })
    return parseOrder(data)
  }

  createOrder(input: {
    tripId: string
    amount: string
    currency: string
    requestId: string
    description: string
  }) {
    return this.call('/v2/checkout/orders', 'POST', input.requestId, {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: input.tripId,
          custom_id: input.tripId,
          description: input.description.slice(0, 127),
          amount: { currency_code: input.currency, value: input.amount },
        },
      ],
    })
  }

  async captureOrder(orderId: string, requestId: string) {
    try {
      return await this.call(
        `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
        'POST',
        requestId,
      )
    } catch (err) {
      // 422 ORDER_ALREADY_CAPTURED and similar: reconcile from the order itself.
      if (err instanceof ProviderError && err.status === 422)
        return this.getOrder(orderId)
      throw err
    }
  }

  getOrder(orderId: string) {
    return this.call(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, 'GET')
  }

  async verifyWebhook(
    headers: Record<string, string | undefined>,
    event: unknown,
    webhookId: string,
  ) {
    const h = (k: string) => headers[k]
    const required = [
      'paypal-auth-algo',
      'paypal-cert-url',
      'paypal-transmission-id',
      'paypal-transmission-sig',
      'paypal-transmission-time',
    ]
    if (required.some((k) => !h(k))) return false
    // PayPal's own verification endpoint checks the certificate and signature.
    // POST /v1/notifications/verify-webhook-signature
    const token = await this.accessToken()
    try {
      const { data } = await requestJson<Json>({
        provider: 'paypal',
        url: `${this.base}/v1/notifications/verify-webhook-signature`,
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: {
          auth_algo: h('paypal-auth-algo'),
          cert_url: h('paypal-cert-url'),
          transmission_id: h('paypal-transmission-id'),
          transmission_sig: h('paypal-transmission-sig'),
          transmission_time: h('paypal-transmission-time'),
          webhook_id: webhookId,
          webhook_event: event,
        },
        fetchImpl: this.fetchImpl,
        timeoutMs: 15_000,
      })
      return data.verification_status === 'SUCCESS'
    } catch {
      return false
    }
  }
}
