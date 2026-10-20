import { describe, expect, it } from 'vitest'
import { loadConfig } from '../server/config.js'
import { AnthropicAiProvider, AiUnavailableError, buildUserMessage } from '../server/providers/ai.js'
import { cleanText, requestJson, safeExternalUrl } from '../server/providers/http.js'
import { PayPalProvider, evaluateOrder, parseOrder } from '../server/providers/payments.js'
import { GooglePlacesProvider, disambiguate, parseOpeningHours } from '../server/providers/places/google.js'
import { FcdoSafetyProvider, fcdoSlug } from '../server/providers/safety.js'
import type { Accommodation, Preferences } from '../shared/types.js'

type Call = { url: string; init: RequestInit }
function fakeFetch(responses: Array<{ status?: number; body: unknown } | Error>) {
  const calls: Call[] = []
  const impl = (async (url: string | URL, init: RequestInit = {}) => {
    calls.push({ url: String(url), init })
    const next = responses.shift()
    if (!next) throw new Error('no more fake responses')
    if (next instanceof Error) throw next
    return new Response(JSON.stringify(next.body), { status: next.status ?? 200, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
  return { impl, calls }
}
const headers = (c: Call) => c.init.headers as Record<string, string>

// ---------------------------------------------------------------- Google

const GOOGLE_PLACE = {
  id: 'ChIJ_test_place_0001',
  displayName: { text: 'Harbour Museum', languageCode: 'en' },
  formattedAddress: '1 Quay St, Town',
  location: { latitude: -33.9, longitude: 18.42 },
  types: ['museum', 'point_of_interest'],
  primaryType: 'museum',
  websiteUri: 'https://museum.example/',
  googleMapsUri: 'https://maps.google.com/?cid=1',
  priceLevel: 'PRICE_LEVEL_INEXPENSIVE',
  regularOpeningHours: {
    periods: [
      { open: { day: 2, hour: 9, minute: 0 }, close: { day: 2, hour: 17, minute: 30 } },
      { open: { day: 5, hour: 18, minute: 0 }, close: { day: 6, hour: 1, minute: 0 } },
    ],
  },
}

describe('GooglePlacesProvider', () => {
  it('sends an explicit field mask, the key in a header, and never more than 50 km', async () => {
    const f = fakeFetch([{ body: { places: [GOOGLE_PLACE] } }, { body: { places: [] } }, { body: {} }, { body: { places: [] } }])
    const g = new GooglePlacesProvider('KEY123', f.impl)
    const out = await g.searchNearby({ lat: -33.92, lng: 18.42 }, 900_000, [])
    expect(f.calls).toHaveLength(4)
    for (const c of f.calls) {
      expect(c.url).toBe('https://places.googleapis.com/v1/places:searchNearby')
      expect(c.url).not.toContain('KEY123')
      expect(headers(c)['X-Goog-Api-Key']).toBe('KEY123')
      const mask = headers(c)['X-Goog-FieldMask']!
      expect(mask).not.toContain('*')
      expect(mask).toContain('places.location')
      const body = JSON.parse(String(c.init.body))
      expect(body.locationRestriction.circle.radius).toBe(50_000)
      expect(body.maxResultCount).toBeLessThanOrEqual(20)
    }
    expect(out).toHaveLength(1)
    const p = out[0]!
    expect(p.location).toEqual({ lat: -33.9, lng: 18.42 })
    expect(p.category).toBe('culture')
    expect(p.categoryEvidence).toContain('museum')
    expect(p.price?.value.level).toBe('low')
    expect(p.price?.status).toBe('PROVIDER_LISTED')
    expect(p.durationMinutes.status).toBe('ESTIMATED')
    expect(p.attribution).toContain('Google')
    expect(p.expiresAt).not.toBeNull()
  })

  it('skips places with no tourist-relevant type and sanitises unsafe URLs', async () => {
    const f = fakeFetch([
      { body: { places: [{ ...GOOGLE_PLACE, types: ['accounting'] }, { ...GOOGLE_PLACE, id: 'ChIJ_test_place_0002', websiteUri: 'javascript:alert(1)' }] } },
    ])
    const g = new GooglePlacesProvider('K', f.impl)
    const out = await g.searchNearby({ lat: 0, lng: 0 }, 50_000, ['culture'])
    expect(out).toHaveLength(1)
    expect(out[0]!.websiteUrl).toBeNull()
  })

  it('parses opening hours, capping overnight closes and handling 24-hour places', () => {
    expect(parseOpeningHours(GOOGLE_PLACE.regularOpeningHours)).toEqual([
      { day: 2, open: '09:00', close: '17:30' },
      { day: 5, open: '18:00', close: '24:00' },
    ])
    expect(parseOpeningHours({ periods: [{ open: { day: 0, hour: 0, minute: 0 } }] })).toHaveLength(7)
    expect(parseOpeningHours({})).toBeNull()
    expect(parseOpeningHours('garbage')).toBeNull()
  })

  it('maps accommodation results and flags area centres', async () => {
    const f = fakeFetch([
      {
        body: {
          places: [
            { id: 'ChIJ_hotel_000001', displayName: { text: 'Sea Point Hotel' }, location: { latitude: 1, longitude: 2 }, types: ['hotel', 'lodging'], addressComponents: [{ longText: 'South Africa', shortText: 'ZA', types: ['country'] }, { longText: 'Cape Town', types: ['locality'] }] },
            { id: 'ChIJ_city_0000001', displayName: { text: 'Cape Town' }, location: { latitude: 1, longitude: 2 }, types: ['locality', 'political'] },
          ],
        },
      },
    ])
    const g = new GooglePlacesProvider('K', f.impl)
    const out = await g.searchAccommodation('cape town', 'destination')
    expect(JSON.parse(String(f.calls[0]!.init.body)).includedType).toBeUndefined()
    expect(out[0]).toMatchObject({ kind: 'hotel', countryCode: 'ZA', locality: 'Cape Town', isAreaCentre: false })
    expect(out[1]).toMatchObject({ kind: 'destination', isAreaCentre: true })
  })

  it('surfaces a provider failure instead of returning empty results', async () => {
    const f = fakeFetch([{ status: 403, body: { error: { message: 'API key not valid' } } }, { status: 403, body: {} }, { status: 403, body: {} }, { status: 403, body: {} }])
    const g = new GooglePlacesProvider('K', f.impl)
    await expect(g.searchNearby({ lat: 0, lng: 0 }, 50_000, [])).rejects.toThrow(/HTTP 403/)
  })

  it('disambiguates duplicate names', () => {
    const base = { provider: 'google' as const, providerPlaceId: 'x', isSample: false, kind: 'hotel' as const, address: null, countryCode: null, location: { lat: 0, lng: 0 }, isAreaCentre: false, disambiguation: null, attribution: null }
    const out = disambiguate([
      { ...base, name: 'Ocean Lodge', locality: 'Durban', country: 'South Africa' },
      { ...base, name: 'Ocean Lodge', locality: 'Hermanus', country: 'South Africa' },
      { ...base, name: 'Unique Inn', locality: 'X', country: 'Y' },
    ])
    expect(out.map((o) => o.disambiguation)).toEqual(['Durban, South Africa', 'Hermanus, South Africa', null])
  })
})

// --------------------------------------------------------------- HTTP util

describe('requestJson', () => {
  it('retries a 503 once, then succeeds', async () => {
    const f = fakeFetch([{ status: 503, body: {} }, { body: { ok: 1 } }])
    const r = await requestJson({ provider: 't', url: 'https://x.example', fetchImpl: f.impl })
    expect(r.data).toEqual({ ok: 1 })
    expect(f.calls).toHaveLength(2)
  })

  it('does not retry a 400', async () => {
    const f = fakeFetch([{ status: 400, body: {} }])
    await expect(requestJson({ provider: 't', url: 'https://x.example', fetchImpl: f.impl })).rejects.toThrow(/HTTP 400/)
    expect(f.calls).toHaveLength(1)
  })

  it('reports network failures without leaking details', async () => {
    const f = fakeFetch([new Error('ECONNRESET secret=abc'), new Error('ECONNRESET secret=abc')])
    await expect(requestJson({ provider: 't', url: 'https://x.example', fetchImpl: f.impl })).rejects.toThrow('t: network error')
  })

  it('rejects malformed JSON', async () => {
    const impl = (async () => new Response('<html>', { status: 200 })) as typeof fetch
    await expect(requestJson({ provider: 't', url: 'https://x.example', fetchImpl: impl })).rejects.toThrow(/malformed JSON/)
  })

  it('cleans text and URLs', () => {
    expect(safeExternalUrl('data:text/html,hi')).toBeNull()
    expect(safeExternalUrl('/relative')).toBeNull()
    expect(safeExternalUrl('https://ok.example/a')).toBe('https://ok.example/a')
    expect(cleanText('  a\u0000b\n c  ')).toBe('a b c')
  })
})

// ---------------------------------------------------------------- PayPal

const order = (status: string, capture?: { status: string; value?: string; currency?: string; custom?: string }) => ({
  id: 'ORDER123ABC',
  status,
  purchase_units: [
    {
      reference_id: 'trip-1',
      custom_id: 'trip-1',
      amount: { currency_code: 'USD', value: '9.00' },
      ...(capture
        ? { payments: { captures: [{ id: 'CAP1', status: capture.status, custom_id: capture.custom ?? 'trip-1', amount: { currency_code: capture.currency ?? 'USD', value: capture.value ?? '9.00' } }] } }
        : {}),
    },
  ],
})
const expected = { tripId: 'trip-1', amount: '9.00', currency: 'USD' }

describe('PayPal order evaluation', () => {
  it('treats only a completed capture with matching amount, currency and guide as paid', () => {
    expect(evaluateOrder(parseOrder(order('COMPLETED', { status: 'COMPLETED' })), expected)).toEqual({ state: 'paid', captureId: 'CAP1' })
    expect(evaluateOrder(parseOrder(order('COMPLETED', { status: 'COMPLETED', value: '0.01' })), expected).state).toBe('mismatch')
    expect(evaluateOrder(parseOrder(order('COMPLETED', { status: 'COMPLETED', currency: 'EUR' })), expected).state).toBe('mismatch')
    expect(evaluateOrder(parseOrder(order('COMPLETED', { status: 'COMPLETED', custom: 'other-trip' })), expected).state).toBe('mismatch')
  })

  it('handles pending, declined, refunded, voided and unapproved orders', () => {
    expect(evaluateOrder(parseOrder(order('COMPLETED', { status: 'PENDING' })), expected).state).toBe('pending')
    expect(evaluateOrder(parseOrder(order('COMPLETED', { status: 'DECLINED' })), expected).state).toBe('failed')
    expect(evaluateOrder(parseOrder(order('COMPLETED', { status: 'REFUNDED' })), expected).state).toBe('failed')
    expect(evaluateOrder(parseOrder(order('VOIDED')), expected).state).toBe('failed')
    expect(evaluateOrder(parseOrder(order('CREATED')), expected).state).toBe('awaiting_approval')
    expect(evaluateOrder(parseOrder({}), expected).state).toBe('awaiting_approval')
  })
})

describe('PayPalProvider', () => {
  it('creates an order server-side with intent CAPTURE, our custom_id and an idempotency key', async () => {
    const f = fakeFetch([{ body: { access_token: 'TOK', expires_in: 3600 } }, { status: 201, body: order('CREATED') }])
    const p = new PayPalProvider({ clientId: 'cid', secret: 'sec', mode: 'sandbox', fetchImpl: f.impl })
    const snap = await p.createOrder({ tripId: 'trip-1', amount: '9.00', currency: 'USD', requestId: 'req-1', description: 'Guide' })
    expect(snap.orderId).toBe('ORDER123ABC')
    const [tokenCall, createCall] = f.calls
    expect(tokenCall!.url).toBe('https://api-m.sandbox.paypal.com/v1/oauth2/token')
    expect(headers(tokenCall!).Authorization).toBe(`Basic ${Buffer.from('cid:sec').toString('base64')}`)
    expect(tokenCall!.init.body).toBe('grant_type=client_credentials')
    expect(createCall!.url).toBe('https://api-m.sandbox.paypal.com/v2/checkout/orders')
    expect(headers(createCall!)['PayPal-Request-Id']).toBe('req-1')
    const body = JSON.parse(String(createCall!.init.body))
    expect(body.intent).toBe('CAPTURE')
    expect(body.purchase_units[0]).toMatchObject({ custom_id: 'trip-1', amount: { currency_code: 'USD', value: '9.00' } })
  })

  it('reconciles an already-captured order (422) by fetching it', async () => {
    const f = fakeFetch([{ body: { access_token: 'TOK', expires_in: 3600 } }, { status: 422, body: { name: 'UNPROCESSABLE_ENTITY', details: [{ issue: 'ORDER_ALREADY_CAPTURED' }] } }, { body: order('COMPLETED', { status: 'COMPLETED' }) }])
    const p = new PayPalProvider({ clientId: 'cid', secret: 'sec', mode: 'sandbox', fetchImpl: f.impl })
    const snap = await p.captureOrder('ORDER123ABC', 'cap-1')
    expect(snap.captureStatus).toBe('COMPLETED')
    expect(f.calls[2]!.init.method).toBe('GET')
  })

  it('uses the live host only in live mode', async () => {
    const f = fakeFetch([{ body: { access_token: 'T', expires_in: 10 } }, { body: order('CREATED') }])
    await new PayPalProvider({ clientId: 'a', secret: 'b', mode: 'live', fetchImpl: f.impl }).getOrder('ORDER123ABC')
    expect(f.calls[0]!.url.startsWith('https://api-m.paypal.com/')).toBe(true)
  })
})

// ---------------------------------------------------------------- Safety

const acc = (over: Partial<Accommodation>): Accommodation => ({
  provider: 'google', providerPlaceId: 'x', isSample: false, name: 'Hotel', kind: 'hotel', address: null, locality: null,
  country: 'Portugal', countryCode: 'PT', location: { lat: 38.7, lng: -9.1 }, isAreaCentre: false, disambiguation: null,
  attribution: null, confirmed: true, confirmedAt: null, resolvedAt: '2026-01-01T00:00:00Z', ...over,
})

describe('FCDO safety provider', () => {
  it('cites the retrieved page with its update date and our check time', async () => {
    const f = fakeFetch([{ body: { title: 'Portugal travel advice', public_updated_at: '2026-09-30T10:00:00Z' } }])
    const s = new FcdoSafetyProvider(f.impl, () => new Date('2026-10-20T12:00:00Z'))
    const [e] = await s.getSafetySources(acc({}))
    expect(f.calls[0]!.url).toBe('https://www.gov.uk/api/content/foreign-travel-advice/portugal')
    expect(e!.status).toBe('source_retrieved')
    expect(e!.source).toMatchObject({ url: 'https://www.gov.uk/foreign-travel-advice/portugal', publishedAt: '2026-09-30T10:00:00Z', checkedAt: '2026-10-20T12:00:00.000Z', status: 'ok' })
    expect(e!.summary).not.toMatch(/\bsafe\b/i)
  })

  it('reports unavailable (not "no warning") when the service fails', async () => {
    const f = fakeFetch([new Error('down'), new Error('down')])
    const [e] = await new FcdoSafetyProvider(f.impl).getSafetySources(acc({}))
    expect(e!.status).toBe('unavailable')
    expect(e!.source?.status).toBe('failed')
  })

  it('reports not found for an unmatched country page', async () => {
    const f = fakeFetch([{ status: 404, body: {} }])
    const [e] = await new FcdoSafetyProvider(f.impl).getSafetySources(acc({ country: 'Atlantis', countryCode: 'AQ' }))
    expect(e!.status).toBe('not_found')
  })

  it('builds slugs', () => {
    expect(fcdoSlug('ZA', 'South Africa')).toBe('south-africa')
    expect(fcdoSlug('US', 'United States')).toBe('usa')
    expect(fcdoSlug(null, 'Côte d’Ivoire')).toBe('cote-d-ivoire')
    expect(fcdoSlug(null, null)).toBeNull()
  })
})

// ---------------------------------------------------------------- Config

describe('configuration', () => {
  it('starts in demo mode with no credentials at all', () => {
    const c = loadConfig({})
    expect(c).toMatchObject({ PLACES_PROVIDER: 'demo', AI_PROVIDER: 'none', PAYMENTS_PROVIDER: 'none', SAFETY_PROVIDER: 'none' })
  })

  it('names missing credentials without printing any values', () => {
    expect(() => loadConfig({ PLACES_PROVIDER: 'google' })).toThrow(/GOOGLE_MAPS_API_KEY/)
    expect(() => loadConfig({ AI_PROVIDER: 'anthropic' })).toThrow(/ANTHROPIC_API_KEY/)
    expect(() => loadConfig({ PAYMENTS_PROVIDER: 'paypal', PAYPAL_CLIENT_ID: 'id-visible' })).toThrow(/PAYPAL_CLIENT_SECRET/)
    try {
      loadConfig({ PAYMENTS_PROVIDER: 'paypal', PAYPAL_CLIENT_ID: 'id-visible' })
    } catch (e) {
      expect(String(e)).not.toContain('id-visible')
    }
  })

  it('refuses live PayPal unless explicitly enabled', () => {
    const base = { PAYMENTS_PROVIDER: 'paypal', PAYPAL_CLIENT_ID: 'a', PAYPAL_CLIENT_SECRET: 'b', PAYPAL_ENV: 'live' }
    expect(() => loadConfig(base)).toThrow(/PAYPAL_LIVE_ENABLED/)
    expect(loadConfig({ ...base, PAYPAL_LIVE_ENABLED: 'true' }).PAYPAL_ENV).toBe('live')
  })
})

// ------------------------------------------------------------------- AI

describe('Anthropic AI provider', () => {
  const prefs: Preferences = { checkIn: '2026-12-10', checkOut: '2026-12-12', adults: 2, childAgeRanges: [], tripType: 'general', budget: null, transport: 'taxi', interests: [], pace: 'balanced', accessibilityNeeds: null, dietaryPreferences: null, settingPreference: 'no_preference', language: 'en' }

  it('maps a refusal or an unparseable response to AiUnavailableError', async () => {
    for (const response of [{ stop_reason: 'refusal', parsed_output: null }, { stop_reason: 'end_turn', parsed_output: null }, { stop_reason: 'max_tokens', parsed_output: null }, { stop_reason: 'end_turn', parsed_output: { days: 'nope' } }]) {
      const fake = { beta: { messages: { parse: async () => response } } }
      const ai = new AnthropicAiProvider('k', 'claude-opus-5-5', fake as never)
      await expect(ai.proposePlan({ preferences: prefs, dates: ['2026-12-10'], places: [] })).rejects.toBeInstanceOf(AiUnavailableError)
    }
  })

  it('sends only candidate ids and facts, with server-side fallbacks enabled', async () => {
    let sent: Record<string, unknown> = {}
    const fake = { beta: { messages: { parse: async (p: Record<string, unknown>) => { sent = p; return { stop_reason: 'end_turn', parsed_output: { days: [] } } } } } }
    const ai = new AnthropicAiProvider('k', 'claude-opus-5-5', fake as never)
    await ai.proposePlan({ preferences: prefs, dates: ['2026-12-10'], places: [] })
    expect(sent.model).toBe('claude-opus-5-5')
    expect(sent.fallbacks).toBe('default')
    expect(sent.betas).toEqual(['server-side-fallback-2026-07-01'])
    const msg = JSON.parse(buildUserMessage({ preferences: prefs, dates: ['2026-12-10'], places: [] }))
    expect(Object.keys(msg)).toEqual(['dates', 'traveller', 'candidates'])
  })
})
