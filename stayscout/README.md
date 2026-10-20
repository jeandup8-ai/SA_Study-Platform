# StayScout

Accommodation-first holiday planning. A traveller confirms where they're staying; StayScout finds worthwhile things to do **within 50 km straight-line distance** of that point, the traveller picks what appeals, and StayScout builds a practical day-by-day plan they can edit, print, export to PDF and share.

> **Where this lives.** StayScout is a separate product from the Study Legends app at the root of this repository. It is self-contained in `stayscout/` (its own `package.json`, build and deploy) and changes nothing in the parent app or its Netlify build. To move it into its own repository: copy this folder to the new repo's root; nothing references the parent.

## Status at a glance

| Area                                 | State                                                                                                                         |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Full traveller journey in demo mode  | Working, unit- and browser-tested                                                                                             |
| 50 km rule (server-enforced)         | Working, tested                                                                                                               |
| Postgres storage + migrations        | Working, tested against Postgres 16                                                                                           |
| Deterministic itinerary planner      | Working, tested                                                                                                               |
| PDF export, print view, share links  | Working, tested; PDF embeds DejaVu fonts (Latin, Greek, Cyrillic…)                                                            |
| Accessibility (WCAG 2.1 AA)          | axe-core scan clean on every page, 320 px reflow and focus checks — all in the e2e suite. Not yet tested with a screen reader |
| Privacy / consumer-law mechanics     | Consent for sensitive notes, 12-month retention, self-hosted fonts, cancellation-right acknowledgement. Legal text is a draft |
| Google Places (New) adapter          | Implemented and fixture-tested; **not live-tested** (no network access to Google from the build environment)                  |
| Anthropic AI planner                 | Implemented and tested with a stub client; **not live-tested** (no API key)                                                   |
| PayPal Orders v2 + webhook (sandbox) | Implemented and fixture-tested; **not live-tested** (no credentials, no network access to PayPal)                             |
| UK FCDO safety source                | Implemented and fixture-tested; **not live-tested** (no network access to GOV.UK)                                             |
| Road routing (distance/time by road) | Interface only (`RoutingProvider`); no provider wired, so the UI shows straight-line distance and labelled rough estimates    |
| User accounts                        | Not implemented; trips belong to the browser that created them (see Security)                                                 |
| Deployment                           | Not performed. Dockerfile and instructions below                                                                              |

## Quick start (demo mode, no credentials)

```bash
cd stayscout
npm install
npm run dev          # API on :8787, web app on http://localhost:5173
```

Search for **"Kestrel Bay"** or **"Harbour View Lodge"**. All demo data is fictional and labelled as such everywhere. Its coordinates are deliberately in the open South Atlantic so no sample place can be mistaken for a real one.

## Commands

| Command                                   | What it does                                                                                                                                        |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                             | API (tsx watch) + Vite dev server with `/api` proxy                                                                                                 |
| `npm run typecheck`                       | Client, server and test type checks                                                                                                                 |
| `npm run lint`                            | oxlint                                                                                                                                              |
| `npm test`                                | Unit, API, provider and payment tests (vitest)                                                                                                      |
| `TEST_DATABASE_URL=postgres://… npm test` | Also runs the Postgres integration tests (they drop and recreate StayScout's tables in that database — use a throwaway one)                         |
| `npm run test:e2e`                        | Builds, starts the production server, runs Playwright on mobile + desktop. Set `PLAYWRIGHT_CHROMIUM_PATH` if your Chromium isn't Playwright-managed |
| `npm run build`                           | Typecheck, build client to `dist/`, compile server to `dist-server/`                                                                                |
| `npm start`                               | Run the production server (serves API + built client)                                                                                               |
| `npm run db:migrate`                      | Apply migrations to `DATABASE_URL` (the server also does this on start)                                                                             |

## Architecture

```
client/            React 19 + Vite + Tailwind 4 SPA (no secrets, no eligibility decisions)
shared/            Code used by both sides: geo.ts (distance + 50 km rule), schemas.ts (zod),
                   travel.ts (estimates), types.ts
server/
  app.ts           HTTP: owner cookie, CSRF/origin check, rate limits, validation, error mapping
  service.ts       Trip business logic
  itinerary/       engine.ts — plan hydration, validation, deterministic scheduler
  providers/       places/ (demo, google), ai.ts, payments.ts (PayPal), safety.ts (FCDO), http.ts
  store/           memory.ts, postgres.ts, migrations.ts
  pdf.ts           PDF guide from the saved, validated plan
  sample.ts        The public sample guide, built by the same code as real trips
tests/             vitest suites      e2e/   Playwright journey
```

### The 50 km invariant

`shared/geo.ts` defines `MAX_RADIUS_M = 50_000` and a haversine distance using the IUGG mean Earth radius (6 371 008.8 m). The boundary is inclusive, with a 1 mm tolerance for floating-point error only. The server re-measures from raw coordinates:

1. after every provider search, and again after merging and de-duplicating providers;
2. on every read of a trip (stored distances are never trusted);
3. when validating any itinerary, whether it came from the scheduler, the AI or a user edit;
4. on save, on edit, on single-day regeneration and before PDF export;
5. when the accommodation changes: places now out of range are deleted from the trip, its selections and its plan.

The radius is never read from a request. A client-supplied `radius` is ignored, and a test proves it.

### Itinerary pipeline

Every plan is a list of `{placeId, slot, kind, startTime, durationMinutes}`. `hydratePlan` builds titles, notes, travel estimates and costs **only from the trip's own place records**. `validateItinerary` rejects: unknown or invented place ids, places outside 50 km, dates outside the stay, duplicate activities, overlapping times (including estimated travel), items past 23:00, more than 4 activities a day, an unconfirmed or changed accommodation, and any slot when a place's listed hours say it is closed. Missing hours are a _warning_ ("not confirmed"), never filled in.

The AI is given only validated candidates (by internal id) and returns a plan through structured output. Any invented id or validation error discards the AI plan and the deterministic scheduler is used, with a visible note. The model is never asked about safety.

### Data honesty

Verification is per claim (hours, price, suitability, setting), using `VERIFIED_SOURCE | PROVIDER_LISTED | ESTIMATED | UNVERIFIED | UNAVAILABLE`. A place is never "verified" as a whole. Durations and travel times are always `ESTIMATED`. Travel time is straight-line × 1.3 at an average speed per transport mode; it is labelled as a rough estimate, not live traffic.

## Switching from demo to live data

1. **Google Places.** In Google Cloud, create a project with billing, enable **Places API (New)**, and create an API key **restricted to Places API (New)** with an IP/server restriction. Set `PLACES_PROVIDER=google` and `GOOGLE_MAPS_API_KEY`. The adapter uses explicit field masks; `websiteUri`, `regularOpeningHours` and `priceLevel` put Nearby Search into a higher-priced SKU, so remove them from `PLACE_FIELDS` in `server/providers/places/google.ts` if cost matters more than detail. One discovery makes up to 4 Nearby Search requests (one per category group). **Set a daily quota cap and a budget alert in Google Cloud before going live.**
2. **Verify it.** Search for a hotel you know. Check that the address and pin are right, that discovery returns places, and that the distances match a map's straight-line measurement.
3. **Terms.** Google content is stored with a 30-day `expiresAt` and shown with attribution; expired records are hidden until discovery is re-run. Have someone review the current Google Maps Platform Terms (caching, attribution, display alongside non-Google maps) before launch.
4. **Safety.** `SAFETY_PROVIDER=fcdo` links the UK FCDO advice page for the destination country (matched by country name), with its update date and our check time. It does not interpret the advice.
5. **AI (optional).** Set `AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY`. The default model is `claude-opus-5-5`, with server-side refusal fallbacks enabled (`fallbacks: "default"`). Each plan is one request of up to 60 candidate places; set a spend limit in the Anthropic Console.

## Payments

Pricing hypothesis: a free preview (stay, places, day 1 of the plan) and the complete guide at **USD 9.00, one-time** (every day, PDF and share link). With `PAYMENTS_PROVIDER=none` everything is unlocked and the UI says so.

The server creates the PayPal order (`custom_id` = trip id), captures it after buyer approval, and marks the guide paid **only** when the capture is `COMPLETED` _and_ the amount, currency and `custom_id` match. Visiting a success URL, or any browser claim, changes nothing (tested). Capture is idempotent: a `PayPal-Request-Id` per order, a reconcile on HTTP 422 (already captured), and stored states where `paid` can only move to `refunded` and `refunded` is final. Pending, declined, voided and cancelled checkouts never unlock; a refund re-locks the guide.

- **Cancellation right.** Before the PayPal buttons appear, the buyer ticks that they want immediate access and lose the 14-day EU/UK cancellation right. The server refuses checkout without it and stores the time on the order (`waiver_acknowledged_at`).
- **Pending captures** are re-checked with PayPal at most once a minute when the trip is viewed.
- **Webhook** (`POST /api/webhooks/paypal`, enabled by `PAYPAL_WEBHOOK_ID`): the signature is verified by PayPal's `verify-webhook-signature` endpoint, then the order is re-fetched from PayPal and evaluated. The event body itself is never trusted. Subscribe to `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.REFUNDED` and `PAYMENT.CAPTURE.REVERSED`.
- Deleting a trip keeps its order record (detached from the trip) so refunds remain possible.

See **[docs/PAYPAL_SANDBOX.md](docs/PAYPAL_SANDBOX.md)** for sandbox setup and the test script. Live mode is refused unless `PAYPAL_ENV=live` **and** `PAYPAL_LIVE_ENABLED=true`.

## Security and privacy

- **No accounts yet.** Each browser gets a random 256-bit token in an `httpOnly`, `SameSite=Lax` cookie (`Secure` in production). Trips store only its SHA-256. Trip ids are random UUIDs, and any request for a trip that isn't yours returns 404. Clearing cookies loses access to your trips; a later account system can claim trips by token.
- Share links use a separate random 256-bit token (stored hashed). They are read-only, omit preferences, are `noindex`, and can be revoked.
- Writes require same-origin `Origin` (when sent) and JSON bodies; bodies are capped at 64 KB.
- In-process rate limits: 300 requests/min per IP overall, 30/min for search, 12/min for discovery, planning, PDF and checkout. Use a shared limiter when running more than one instance. Behind a proxy (`TRUST_PROXY=true`) the client IP is the right-most `X-Forwarded-For` entry, which assumes exactly one trusted proxy.
- Itinerary saves are compare-and-set on the plan version, so two tabs can't overwrite each other.
- Keys are server-only. The only provider value sent to the browser is the PayPal **client id**, which is public by design.
- Provider responses are parsed defensively: size-capped, timed out, retried once on 429/5xx, URLs restricted to http(s), text sanitised.
- Responses send a CSP, `nosniff`, a referrer policy and `frame-ancestors 'none'`.
- No children's names or birth dates are collected — age ranges only. Users can export trip data as JSON and delete trips.
- The optional accessibility and dietary notes may be special-category data. They are stored only with an explicit consent tick (enforced by the server), never sent to the AI provider, and never included in share links.
- Trips untouched for `TRIP_RETENTION_DAYS` (default 365, matching the cookie) are deleted automatically, daily.
- Fonts are bundled and served from StayScout's own origin, so no visitor IPs go to a font CDN. The only third-party script is PayPal's, and it loads only at checkout.
- Privacy and Terms pages are **drafts for the operator to edit**: placeholders are highlighted and they have not had legal review. See "Before launch: legal" below.

## Deployment

The app is one Node process that serves the API and the built client, and it needs Postgres for persistence. Netlify (the parent repo's host) is not a good fit without rewriting the API as functions, so a container host is recommended.

**Render / Railway / Fly.io (Docker):**

1. Create a Postgres database (Neon free tier, Render, Railway or Supabase) and copy its connection string.
2. Create a web service from this repo with **root directory `stayscout`**, using the `Dockerfile`.
3. Set the environment: `NODE_ENV=production`, `PUBLIC_BASE_URL=https://your-domain`, `DATABASE_URL`, `DATABASE_SSL=true`, `TRUST_PROXY=true`, plus any provider variables. `PORT` is usually injected by the host.
4. Health check path: `/api/health`. Migrations run automatically on start (with an advisory lock).

**Without Docker:** `npm ci && npm run build && npm start` with the same environment.

### Post-deployment smoke test

- [ ] `/api/health` returns `{"ok":true}` and `/api/status` shows the expected modes
- [ ] The footer status line matches (data / AI / payments / safety / storage = database)
- [ ] Landing, `/sample`, `/privacy`, `/terms` and a 404 page render on a phone
- [ ] Create a trip and confirm the stay. Discovery returns places, and every distance is ≤ 50 km on an independent map measurement
- [ ] Build a plan, remove an item, regenerate one day, download the PDF
- [ ] Open a share link in a private window; open the trip URL there and confirm it 404s
- [ ] Restart the service; the trip is still there
- [ ] `/robots.txt` disallows `/trips`, `/g/`, `/plan` and `/api/`; `/sitemap.xml` uses `PUBLIC_BASE_URL`
- [ ] PayPal sandbox purchase per `docs/PAYPAL_SANDBOX.md` before considering live mode

## Before launch: legal

These need the operator or counsel; the code can't settle them.

1. Fill in every highlighted placeholder on `/privacy` and `/terms`: entity, address, contacts (ECTA s43), Information Officer, processors and countries, log retention, refund policy, VAT, governing law.
2. Register the Information Officer with South Africa's Information Regulator (POPIA).
3. Sign or accept data-processing terms with Google Maps Platform, Anthropic (if the AI planner is on), and your host and database providers. Confirm the transfer safeguards each one offers (POPIA s72; EU SCCs / UK Addendum).
4. Decide with counsel whether you need EU and UK representatives (GDPR Art. 27) once you are marketing to those travellers.
5. VAT: South African VAT on electronic services, plus EU/UK VAT on digital sales to consumers (EU OSS). Display prices accordingly.
6. Check the cancellation and refund rules under ECTA s44 and the Consumer Protection Act. The immediate-supply acknowledgement covers the EU/UK rule; the South African position needs confirming.

## Known limitations

- Live adapters (Google, PayPal, FCDO, Anthropic) have not been exercised against the real services.
- There is no road routing; travel times are rough straight-line estimates.
- There is no weather forecast. Rainy-day alternatives are offered without claiming any forecast.
- The PDF covers Latin, Greek, Cyrillic and other scripts DejaVu supports. Chinese, Japanese and Korean characters print as `?`, and Arabic and Hebrew names print the right letters in the wrong order (no right-to-left shaping).
- The PDF fetches the safety panel live at export time; if the source is down, the PDF says so.
- Opening-hours checks use the place's local time and do not model public holidays or seasonal hours.
- English only.
- No destination photography: there were no licensed images to use. The design uses original line art instead.
