// Entry point: validates config, wires providers, serves the API and the built client.

import { readFile } from 'node:fs/promises'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { getConnInfo } from '@hono/node-server/conninfo'
import type { Context } from 'hono'
import { SECURITY_HEADERS, createApp } from './app.js'
import { loadConfig, type Config } from './config.js'
import { AnthropicAiProvider } from './providers/ai.js'
import { PayPalProvider } from './providers/payments.js'
import { DemoPlacesProvider } from './providers/places/demo.js'
import { GooglePlacesProvider } from './providers/places/google.js'
import { FcdoSafetyProvider, NoSafetyProvider } from './providers/safety.js'
import { TripService } from './service.js'
import { MemoryStore } from './store/memory.js'
import { PostgresStore } from './store/postgres.js'
import type { Store } from './store/types.js'

export async function buildServer(config: Config) {
  let store: Store
  if (config.DATABASE_URL) {
    const pg = new PostgresStore(config.DATABASE_URL, config.DATABASE_SSL === 'true')
    await pg.migrate()
    store = pg
  } else {
    store = new MemoryStore()
    console.warn(
      '[stayscout] DATABASE_URL not set: using in-memory storage. Trips are lost on restart.',
    )
  }

  const places =
    config.PLACES_PROVIDER === 'google'
      ? new GooglePlacesProvider(config.GOOGLE_MAPS_API_KEY!)
      : new DemoPlacesProvider()
  const ai =
    config.AI_PROVIDER === 'anthropic'
      ? new AnthropicAiProvider(config.ANTHROPIC_API_KEY!, config.ANTHROPIC_MODEL)
      : null
  const payments =
    config.PAYMENTS_PROVIDER === 'paypal'
      ? new PayPalProvider({
          clientId: config.PAYPAL_CLIENT_ID!,
          secret: config.PAYPAL_CLIENT_SECRET!,
          mode: config.PAYPAL_ENV,
        })
      : null
  const safety =
    config.SAFETY_PROVIDER === 'fcdo' ? new FcdoSafetyProvider() : new NoSafetyProvider()
  const service = new TripService({ config, store, places, ai, payments, safety })

  const app = createApp({
    config,
    service,
    store,
    clientIp: (c: Context) =>
      config.TRUST_PROXY === 'true'
        ? (c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown')
        : (getConnInfo(c).remote.address ?? 'unknown'),
  })

  app.get('/robots.txt', (c) =>
    c.text(
      [
        'User-agent: *',
        'Disallow: /api/',
        'Disallow: /trips',
        'Disallow: /g/',
        'Disallow: /plan',
        config.PUBLIC_BASE_URL
          ? `Sitemap: ${new URL('/sitemap.xml', config.PUBLIC_BASE_URL)}`
          : '',
      ].join('\n'),
    ),
  )
  app.get('/sitemap.xml', (c) => {
    const base = config.PUBLIC_BASE_URL ?? new URL(c.req.url).origin
    const urls = ['/', '/sample', '/privacy', '/terms'].map(
      (p) => `  <url><loc>${new URL(p, base)}</loc></url>`,
    )
    c.header('Content-Type', 'application/xml')
    return c.body(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
    )
  })

  // Built client (npm run build). Hashed assets are immutable.
  app.use('/assets/*', async (c, next) => {
    await next()
    c.header('Cache-Control', 'public, max-age=31536000, immutable')
  })
  app.use('/*', serveStatic({ root: './dist' }))
  let indexHtml: string | null = null
  app.get('*', async (c) => {
    indexHtml ??= await readFile('./dist/index.html', 'utf8').catch(() => null)
    if (!indexHtml)
      return c.text(
        'Client not built. Run `npm run build`, or use `npm run dev` for development.',
        503,
      )
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) c.header(k, v)
    // Private pages stay out of search engines.
    if (/^\/(trips|g|plan)(\/|$)/.test(c.req.path))
      c.header('X-Robots-Tag', 'noindex, nofollow')
    return c.html(indexHtml)
  })

  return { app, store, status: service.status() }
}

const isMain = import.meta.url === `file://${process.argv[1]}`
if (isMain) {
  const config = loadConfig()
  const { app, store, status } = await buildServer(config)
  const server = serve({ fetch: app.fetch, port: config.PORT }, (info) => {
    console.log(`[stayscout] listening on http://localhost:${info.port}`)
    console.log(
      `[stayscout] places=${status.places.provider}(${status.places.mode}) ai=${status.ai.mode} payments=${status.payments.mode} safety=${status.safety.mode} storage=${status.storage}`,
    )
  })
  const shutdown = () => {
    server.close()
    void store.close().finally(() => process.exit(0))
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}
