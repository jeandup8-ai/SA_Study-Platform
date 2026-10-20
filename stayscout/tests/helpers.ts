import { createApp } from '../server/app.js'
import { loadConfig, type Config } from '../server/config.js'
import type { AiProvider } from '../server/providers/ai.js'
import type { PaymentProvider } from '../server/providers/payments.js'
import { DemoPlacesProvider } from '../server/providers/places/demo.js'
import type { PlacesProvider } from '../server/providers/places/types.js'
import { NoSafetyProvider, type SafetyProvider } from '../server/providers/safety.js'
import { TripService } from '../server/service.js'
import { MemoryStore } from '../server/store/memory.js'
import type { Store } from '../server/store/types.js'

export const BASE = 'http://localhost'

export function setup(
  over: {
    places?: PlacesProvider
    ai?: AiProvider | null
    payments?: PaymentProvider | null
    safety?: SafetyProvider
    store?: Store
    config?: Partial<Config>
  } = {},
) {
  const config = { ...loadConfig({ NODE_ENV: 'test' }), ...over.config }
  const store = over.store ?? new MemoryStore()
  const service = new TripService({
    config,
    store,
    places: over.places ?? new DemoPlacesProvider(),
    ai: over.ai ?? null,
    payments: over.payments ?? null,
    safety: over.safety ?? new NoSafetyProvider(),
  })
  const app = createApp({ config, service, store, clientIp: () => 'test' })
  return { app, store, service, config }
}

/** A tiny cookie-carrying client, one per simulated browser. */
export function client(app: ReturnType<typeof setup>['app']) {
  let cookie = ''
  const call = async (
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ) => {
    const res = await app.request(`${BASE}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const set = res.headers.get('set-cookie')
    if (set) cookie = set.split(';')[0]!
    const type = res.headers.get('content-type') ?? ''
    const data = type.includes('json')
      ? await res.json()
      : type.includes('pdf')
        ? Buffer.from(await res.arrayBuffer())
        : await res.text()
    return { status: res.status, data: data as any, headers: res.headers }
  }
  return {
    get: (p: string) => call('GET', p),
    post: (p: string, b: unknown = {}, h?: Record<string, string>) =>
      call('POST', p, b, h),
    put: (p: string, b: unknown) => call('PUT', p, b),
    del: (p: string) => call('DELETE', p),
  }
}

export const PREFS = {
  checkIn: '2026-12-10',
  checkOut: '2026-12-14',
  adults: 2,
  childAgeRanges: [],
  tripType: 'honeymoon',
  transport: 'rental_car',
  interests: ['beaches', 'culture', 'food', 'wildlife'],
  pace: 'balanced',
}

/** Creates a confirmed resort trip with preferences and discovery done. */
export async function readyTrip(
  c: ReturnType<typeof client>,
  providerPlaceId = 'demo-acc-kestrel-resort',
  prefs: object = PREFS,
) {
  const created = await c.post('/api/trips', { provider: 'demo', providerPlaceId })
  const id = created.data.id as string
  await c.post(`/api/trips/${id}/accommodation/confirm`, {})
  await c.put(`/api/trips/${id}/preferences`, prefs)
  const discovered = await c.post(`/api/trips/${id}/discover`, {})
  return { id, view: discovered.data }
}
