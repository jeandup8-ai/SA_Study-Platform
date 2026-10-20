// HTTP layer: authentication (owner cookie / share token), validation, rate
// limits, security headers and error mapping. Business rules live in service.ts.

import { Hono, type Context } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import { z } from 'zod'
import {
  accommodationSearchSchema,
  accommodationSelectSchema,
  captureSchema,
  confirmAccommodationSchema,
  itineraryEditSchema,
  preferencesSchema,
  selectionSchema,
} from '../shared/schemas.js'
import type { Config } from './config.js'
import { renderGuidePdf } from './pdf.js'
import { RateLimiter } from './rate-limit.js'
import { sampleGuide } from './sample.js'
import { ServiceError, TripService, newToken, sha256 } from './service.js'
import type { Store, TripRow } from './store/types.js'

const OWNER_COOKIE = 'ss_owner'
const uuid = z.uuid()

export interface AppOptions {
  config: Config
  service: TripService
  store: Store
  /** Resolves the client IP; injected so tests and proxies can supply it. */
  clientIp?: (c: Context) => string
}

type Env = { Variables: { ownerHash: string | null } }

export function createApp({ config, service, store, clientIp }: AppOptions) {
  const app = new Hono<Env>()
  const ipOf = clientIp ?? ((c: Context) => (config.TRUST_PROXY === 'true' ? (c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown') : 'local'))
  const limiters = {
    general: new RateLimiter(300, 60_000),
    search: new RateLimiter(30, 60_000),
    expensive: new RateLimiter(12, 60_000),
  }
  const limit = (c: Context, kind: keyof typeof limiters) => {
    const wait = limiters[kind].check(`${kind}:${ipOf(c)}`)
    if (wait > 0) {
      c.header('Retry-After', String(wait))
      throw new ServiceError(429, 'rate_limited', 'Too many requests. Please wait a moment and try again.')
    }
  }

  // ------------------------------------------------------------ middleware

  app.use('/api/*', async (c, next) => {
    c.header('Cache-Control', 'no-store')
    c.header('X-Robots-Tag', 'noindex')
    limit(c, 'general')
    const method = c.req.method
    if (method !== 'GET' && method !== 'HEAD') {
      // CSRF: SameSite=Lax cookie + same-origin check + JSON bodies only.
      const origin = c.req.header('origin')
      if (origin) {
        const allowed = new Set([new URL(c.req.url).origin, config.PUBLIC_BASE_URL && new URL(config.PUBLIC_BASE_URL).origin].filter(Boolean))
        if (!allowed.has(origin)) throw new ServiceError(403, 'bad_origin', 'Cross-site request refused.')
      }
      const len = Number(c.req.header('content-length') ?? '0')
      if (len > 64_000) throw new ServiceError(413, 'too_large', 'Request body is too large.')
      if (len > 0 && !c.req.header('content-type')?.startsWith('application/json')) {
        throw new ServiceError(415, 'json_required', 'Send JSON.')
      }
    }
    const token = getCookie(c, OWNER_COOKIE)
    c.set('ownerHash', token && /^[A-Za-z0-9_-]{43}$/.test(token) ? sha256(token) : null)
    await next()
  })

  /** Issues the anonymous owner cookie on first write. */
  const ownerHash = (c: Context<Env>): string => {
    const existing = c.get('ownerHash')
    if (existing) return existing
    const token = newToken()
    setCookie(c, OWNER_COOKIE, token, {
      httpOnly: true,
      sameSite: 'Lax',
      secure: config.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    })
    const hash = sha256(token)
    c.set('ownerHash', hash)
    return hash
  }

  /** 404 (not 403) for both "missing" and "not yours", so ids can't be probed. */
  const ownedTrip = async (c: Context<Env>): Promise<TripRow> => {
    const id = c.req.param('id')
    const hash = c.get('ownerHash')
    if (!hash || !uuid.safeParse(id).success) throw notFound()
    const trip = await store.getTrip(id!)
    if (!trip || trip.ownerHash !== hash) throw notFound()
    return trip
  }
  const notFound = () => new ServiceError(404, 'not_found', 'Trip not found.')

  const body = async <T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> => {
    let raw: unknown = {}
    const text = await c.req.text()
    if (text) {
      try {
        raw = JSON.parse(text)
      } catch {
        throw new ServiceError(400, 'bad_json', 'Malformed JSON.')
      }
    }
    const parsed = schema.safeParse(raw)
    if (!parsed.success) {
      throw new ServiceError(400, 'invalid_input', 'Some fields need attention.', parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })))
    }
    return parsed.data
  }

  // ---------------------------------------------------------------- routes

  app.get('/api/health', (c) => c.json({ ok: true }))
  app.get('/api/status', (c) => c.json(service.status()))
  app.get('/api/sample', async (c) => c.json(await sampleGuide(config)))

  app.post('/api/accommodation/search', async (c) => {
    limit(c, 'search')
    const { query, kind } = await body(c, accommodationSearchSchema)
    try {
      return c.json(await service.searchAccommodation(query, kind))
    } catch (err) {
      if (err instanceof ServiceError) throw err
      throw new ServiceError(503, 'places_unavailable', 'Accommodation search is unavailable right now. Please try again shortly.')
    }
  })

  app.get('/api/trips', async (c) => {
    const hash = c.get('ownerHash')
    if (!hash) return c.json({ trips: [] })
    const trips = await store.listTripsByOwner(hash)
    return c.json({
      trips: trips.map((t) => ({ id: t.id, updatedAt: t.updatedAt, name: t.accommodation?.name ?? 'Untitled trip', checkIn: t.preferences?.checkIn ?? null, checkOut: t.preferences?.checkOut ?? null, isSample: t.accommodation?.isSample ?? false })),
    })
  })

  app.post('/api/trips', async (c) => {
    const sel = await body(c, accommodationSelectSchema)
    const trip = await service.createTrip(ownerHash(c), sel)
    return c.json(await service.view(trip), 201)
  })

  app.get('/api/trips/:id', async (c) => c.json(await service.view(await ownedTrip(c))))

  app.delete('/api/trips/:id', async (c) => {
    const trip = await ownedTrip(c)
    await store.deleteTrip(trip.id)
    return c.body(null, 204)
  })

  app.get('/api/trips/:id/export.json', async (c) => {
    const trip = await ownedTrip(c)
    c.header('Content-Disposition', 'attachment; filename="stayscout-trip.json"')
    return c.json({ exportedAt: new Date().toISOString(), trip: await service.view(trip) })
  })

  app.put('/api/trips/:id/accommodation', async (c) => {
    const trip = await ownedTrip(c)
    const sel = await body(c, accommodationSelectSchema)
    const r = await service.changeAccommodation(trip, sel)
    return c.json({ trip: await service.view(r.trip), removedPlaces: r.removedPlaces, removedFromPlan: r.removedFromPlan })
  })

  app.post('/api/trips/:id/accommodation/confirm', async (c) => {
    const trip = await ownedTrip(c)
    const { acknowledgeAreaCentre } = await body(c, confirmAccommodationSchema)
    return c.json(await service.view(await service.confirmAccommodation(trip, acknowledgeAreaCentre)))
  })

  app.put('/api/trips/:id/preferences', async (c) => {
    const trip = await ownedTrip(c)
    const prefs = await body(c, preferencesSchema)
    return c.json(await service.view(await service.setPreferences(trip, prefs)))
  })

  app.post('/api/trips/:id/discover', async (c) => {
    limit(c, 'expensive')
    const trip = await ownedTrip(c)
    // Any radius the client sends is ignored; only the server constant is used.
    return c.json(await service.view(await service.discover(trip)))
  })

  app.put('/api/trips/:id/selections', async (c) => {
    const trip = await ownedTrip(c)
    const { placeId, ...sel } = await body(c, selectionSchema)
    await service.setSelection(trip, placeId, sel)
    return c.json({ ok: true })
  })

  app.post('/api/trips/:id/itinerary', async (c) => {
    limit(c, 'expensive')
    const trip = await ownedTrip(c)
    const { useAi } = await body(c, z.object({ useAi: z.boolean().default(true) }))
    const r = await service.generate(trip, { useAi })
    return c.json(await service.view(r.trip))
  })

  app.post('/api/trips/:id/itinerary/days/:day/regenerate', async (c) => {
    limit(c, 'expensive')
    const trip = await ownedTrip(c)
    const day = z.coerce.number().int().min(0).max(40).safeParse(c.req.param('day'))
    if (!day.success) throw new ServiceError(400, 'invalid_input', 'Invalid day.')
    const r = await service.regenerateDay(trip, day.data)
    return c.json(await service.view(r.trip))
  })

  app.put('/api/trips/:id/itinerary', async (c) => {
    const trip = await ownedTrip(c)
    const edit = await body(c, itineraryEditSchema)
    const r = await service.editItinerary(trip, edit)
    return c.json(await service.view(r.trip))
  })

  app.get('/api/trips/:id/safety', async (c) => c.json(await service.safety(await ownedTrip(c))))

  app.get('/api/trips/:id/guide.pdf', async (c) => {
    limit(c, 'expensive')
    const trip = await ownedTrip(c)
    const view = await service.exportableView(trip)
    const safety = await service.safety(trip).catch(() => null)
    const pdf = await renderGuidePdf(view, safety)
    return c.body(new Uint8Array(pdf), 200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="stayscout-guide.pdf"',
    })
  })

  app.post('/api/trips/:id/share', async (c) => {
    const trip = await ownedTrip(c)
    return c.json({ token: await service.enableShare(trip) })
  })

  app.delete('/api/trips/:id/share', async (c) => {
    await service.disableShare(await ownedTrip(c))
    return c.body(null, 204)
  })

  app.get('/api/shared/:token', async (c) => {
    const token = c.req.param('token')
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ServiceError(404, 'not_found', 'This link is not valid or was turned off.')
    const trip = await store.findTripByShareHash(sha256(token))
    if (!trip) throw new ServiceError(404, 'not_found', 'This link is not valid or was turned off.')
    return c.json(await service.view(trip, { readOnly: true }))
  })

  app.post('/api/trips/:id/checkout', async (c) => {
    limit(c, 'expensive')
    return c.json(await service.createCheckout(await ownedTrip(c)))
  })

  app.post('/api/trips/:id/checkout/capture', async (c) => {
    limit(c, 'expensive')
    const trip = await ownedTrip(c)
    const { orderId } = await body(c, captureSchema)
    return c.json(await service.captureCheckout(trip, orderId))
  })

  app.all('/api/*', () => {
    throw new ServiceError(404, 'not_found', 'Not found.')
  })

  app.onError((err, c) => {
    if (err instanceof ServiceError) {
      return c.json({ error: { code: err.code, message: err.message, details: err.details } }, err.status as 400)
    }
    // Log the type and message only; never request bodies or provider payloads.
    console.error(`[error] ${c.req.method} ${c.req.routePath}: ${err.name}: ${err.message}`)
    return c.json({ error: { code: 'internal', message: 'Something went wrong on our side. Please try again.' } }, 500)
  })

  return app
}

export const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' https://www.paypal.com",
    "frame-src https://www.paypal.com https://www.sandbox.paypal.com",
    "connect-src 'self' https://www.paypal.com https://www.sandbox.paypal.com",
    "img-src 'self' data: https://www.paypalobjects.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    'font-src https://fonts.gstatic.com',
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
  'Permissions-Policy': 'geolocation=(), camera=(), microphone=()',
}
