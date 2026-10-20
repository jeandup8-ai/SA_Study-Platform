import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { TripView } from '../../../shared/types'
import { api, type TripSummary } from '../api'
import { GuideView, SafetyPanelView } from '../components/GuideView'
import { fmtDate, useNoIndex, usePageTitle } from '../lib'
import { PlaceCard } from '../components/PlaceCard'
import {
  EmptyState,
  ErrorNotice,
  SampleBanner,
  SampleTag,
  Spinner,
} from '../components/ui'
import { OFFICIAL_ADVISORY_LINKS, SAFETY_DISCLAIMER } from '../../../shared/safety-copy'

function ReadOnlyGuide({ trip, intro }: { trip: TripView; intro?: ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      {intro}
      <GuideView trip={trip} />
      {trip.accommodation?.isSample ? (
        <SafetyPanelView
          safety={{
            checkedAt: trip.updatedAt,
            entries: [
              {
                status: 'not_checked',
                title: 'Sample destination — no advisory exists',
                summary:
                  'Kestrel Bay is fictional, so there is no official advice to show. In a live guide this panel lists the official sources StayScout retrieved, with dates.',
                source: null,
                limitations: ['Not checked by StayScout.'],
              },
            ],
            officialLinks: OFFICIAL_ADVISORY_LINKS,
            disclaimer: SAFETY_DISCLAIMER,
          }}
        />
      ) : (
        <p className="rounded-xl bg-sand p-3 text-sm">{SAFETY_DISCLAIMER}</p>
      )}
      <section aria-labelledby="places-heading">
        <h2 id="places-heading" className="font-display text-2xl">
          Places in this guide
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {trip.places.map((p) => (
            <PlaceCard key={p.id} place={p} />
          ))}
        </div>
      </section>
    </div>
  )
}

export function Sample() {
  usePageTitle('Sample guide')
  const [trip, setTrip] = useState<TripView | null>(null)
  const [error, setError] = useState<unknown>(null)
  // State is only set when the request settles, never synchronously in the effect.
  const load = () =>
    api.sample().then((t) => {
      setTrip(t)
      setError(null)
    }, setError)
  useEffect(() => {
    void load()
  }, [])
  if (error)
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <ErrorNotice error={error} onRetry={load} />
      </div>
    )
  if (!trip)
    return (
      <div className="mx-auto max-w-3xl px-4">
        <Spinner label="Loading the sample guide…" />
      </div>
    )
  const selectedOnly = {
    ...trip,
    places: trip.places.filter((p) =>
      trip.itinerary?.days.some((d) => d.items.some((i) => i.placeId === p.id)),
    ),
  }
  return (
    <ReadOnlyGuide
      trip={selectedOnly}
      intro={
        <>
          <p className="eyebrow">Sample guide</p>
          <h1 className="font-display text-4xl">What a StayScout guide looks like</h1>
          <SampleBanner what="This guide uses" />
          <p className="text-muted">
            A family of three, four days at a fictional beach resort, with a rental car
            and a balanced pace. It was built by the same planner your trip uses.{' '}
            <Link to="/plan" className="text-sea underline">
              Plan your own stay
            </Link>
            .
          </p>
        </>
      }
    />
  )
}

export function Shared() {
  useNoIndex()
  usePageTitle('Shared guide')
  const { token = '' } = useParams()
  const [trip, setTrip] = useState<TripView | null>(null)
  const [error, setError] = useState<unknown>(null)
  useEffect(() => {
    api.shared(token).then(setTrip, setError)
  }, [token])
  if (error)
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState title="This link isn’t available">
          It may have been turned off by its owner, or mistyped.
        </EmptyState>
      </div>
    )
  if (!trip)
    return (
      <div className="mx-auto max-w-3xl px-4">
        <Spinner label="Loading guide…" />
      </div>
    )
  return (
    <ReadOnlyGuide
      trip={trip}
      intro={
        <>
          {trip.accommodation?.isSample && <SampleBanner what="This guide uses" />}
          <p className="text-sm text-muted">
            A read-only StayScout guide shared with you.
          </p>
        </>
      }
    />
  )
}

export function MyTrips() {
  useNoIndex()
  usePageTitle('My trips')
  const [trips, setTrips] = useState<TripSummary[] | null>(null)
  const [error, setError] = useState<unknown>(null)
  const load = () =>
    api.listTrips().then((r) => {
      setTrips(r.trips)
      setError(null)
    }, setError)
  useEffect(() => {
    void load()
  }, [])
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-4xl">My trips</h1>
      <p className="mt-2 text-muted">
        Trips are saved to this browser. There are no accounts yet, so a different browser
        or device won’t see them.
      </p>
      <div className="mt-6">
        {error ? <ErrorNotice error={error} onRetry={load} /> : null}
        {!trips && !error && <Spinner label="Loading…" />}
        {trips && trips.length === 0 && (
          <EmptyState title="No trips yet">
            <Link to="/plan" className="text-sea underline">
              Plan your first stay
            </Link>
          </EmptyState>
        )}
        <ul className="space-y-3">
          {trips?.map((t) => (
            <li key={t.id}>
              <Link
                to={`/trips/${t.id}`}
                className="card flex items-center justify-between gap-3 p-4 hover:border-sea"
              >
                <span>
                  <span className="flex items-center gap-2 font-medium">
                    {t.name} {t.isSample && <SampleTag />}
                  </span>
                  <span className="text-sm text-muted">
                    {t.checkIn && t.checkOut
                      ? `${fmtDate(t.checkIn)} – ${fmtDate(t.checkOut)}`
                      : 'Dates not set'}
                  </span>
                </span>
                <span aria-hidden>→</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function NotFound() {
  usePageTitle('Page not found')
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-2 font-display text-4xl">This page is outside our radius</h1>
      <p className="mt-3 text-muted">
        The page you were looking for doesn’t exist or has moved.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link to="/" className="btn btn-secondary">
          Home
        </Link>
        <Link to="/plan" className="btn btn-primary">
          Plan my stay
        </Link>
      </div>
    </div>
  )
}

function Legal({ title, children }: { title: string; children: ReactNode }) {
  usePageTitle(title)
  return (
    <article className="mx-auto max-w-3xl space-y-4 px-4 py-10 sm:px-6 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-2xl [&_p]:text-muted [&_li]:text-muted [&_ul]:list-disc [&_ul]:pl-5">
      <h1 className="font-display text-4xl">{title}</h1>
      <p className="rounded-xl bg-amber-soft p-3 text-sm !text-amber-ink">
        Draft for the operator to review and edit. It has not been reviewed by a lawyer
        and is not a statement of legal compliance.
      </p>
      {children}
    </article>
  )
}

/** Placeholder the operator must replace before launch; styled so it can't be missed. */
function Fill({ children }: { children: ReactNode }) {
  return <mark className="rounded bg-amber-soft px-1 text-amber-ink">[{children}]</mark>
}

export function Privacy() {
  return (
    <Legal title="Privacy notice">
      <p>
        Last updated: <Fill>date</Fill>
      </p>

      <h2>Who we are</h2>
      <p>
        StayScout is operated by <Fill>legal entity name, registration number</Fill>,{' '}
        <Fill>physical address</Fill> (“we”). We are the responsible party under South
        Africa’s POPIA and the controller under the EU and UK GDPR. Information Officer /
        privacy contact: <Fill>name, email</Fill>.{' '}
        <Fill>
          If you serve EU/UK travellers regularly: name and address of your EU and UK
          representatives, or delete this sentence after legal advice.
        </Fill>
      </p>

      <h2>What we collect, why, and on what basis</h2>
      <ul>
        <li>
          <strong>Your accommodation</strong> (name, address and coordinates from our
          place-data provider) and <strong>trip details</strong> — dates, number of
          adults, children’s age ranges (never names or birth dates), interests, pace,
          transport, budget and your selections. Used to find places within 50 km and
          build your plan. Basis: performing the service you asked for (GDPR Art. 6(1)(b);
          POPIA s11(1)(b)).
        </li>
        <li>
          <strong>Optional accessibility and dietary notes.</strong> These can reveal
          health or religious information. We only save them if you tick the box agreeing
          to it (explicit consent: GDPR Art. 9(2)(a); POPIA s27(1)(a)). They are shown
          with your plan only — never sent to our AI planner or included in share links —
          and you can clear them at any time.
        </li>
        <li>
          <strong>A random identifier in a cookie</strong> (<code>ss_owner</code>) so this
          browser can reopen its trips. It is strictly necessary for the service, so no
          cookie consent is needed; we store only a one-way hash of it. It lasts 12
          months. We use no advertising or analytics cookies.
        </li>
        <li>
          <strong>Payment records</strong> if you buy the complete guide: PayPal’s order
          and capture references, amount, status, and when you confirmed you wanted
          immediate access. We never see or store card details. Basis: contract, and legal
          obligations for accounting records.
        </li>
        <li>
          <strong>Server logs</strong> with IP addresses and request paths, kept briefly
          to keep the service running and secure (legitimate interests).{' '}
          <Fill>log retention period</Fill>
        </li>
      </ul>
      <p>
        Giving trip details is voluntary, but without dates and an accommodation we cannot
        build a plan.
      </p>

      <h2>Who receives it</h2>
      <ul>
        <li>
          <strong>Google Places</strong> (Google LLC, USA) receives your accommodation
          search and its location, to find properties and nearby places.
        </li>
        <li>
          <strong>Anthropic</strong> (USA), only if the AI planner is switched on,
          receives your trip preferences (without the optional notes) and the list of
          nearby places. It does not receive your name, IP address or identifier.
        </li>
        <li>
          <strong>PayPal</strong> processes payments as an independent controller under
          its own privacy notice.
        </li>
        <li>
          Our hosting and database providers: <Fill>names and countries</Fill>.
        </li>
        <li>
          Anyone you give a share link to can view that guide (not your preferences).
        </li>
      </ul>
      <p>
        Some of these providers are outside South Africa, the EU and the UK. We rely on{' '}
        <Fill>
          the safeguards in each provider’s data processing terms, e.g. EU Standard
          Contractual Clauses / UK Addendum; POPIA s72 binding agreements
        </Fill>
        .
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>
          Trips are deleted automatically after 12 months without changes, or straight
          away when you delete them.
        </li>
        <li>
          Payment records are kept after a trip is deleted, for refunds and for as long as
          tax law requires <Fill>e.g. 5 years</Fill>, without your trip details.
        </li>
      </ul>

      <h2>Your rights</h2>
      <p>
        You can access, correct, export, restrict, object to, or delete your data, and
        withdraw consent for the optional notes at any time. On each trip page you can
        download your data (JSON) and delete the trip. For anything else, contact{' '}
        <Fill>email</Fill>. Because there are no accounts, we may ask you to make the
        request from the browser that holds the trip.
      </p>
      <p>
        You can complain to South Africa’s Information Regulator (inforegulator.org.za),
        the UK ICO (ico.org.uk), or your EU data protection authority.
      </p>

      <h2>Security</h2>
      <p>
        Data is sent over HTTPS, trip pages are only available to the browser that created
        them, and share links use long random tokens that you can turn off. No system is
        perfectly secure; we will notify the regulator and affected people of a breach
        where the law requires.
      </p>
    </Legal>
  )
}

export function Terms() {
  return (
    <Legal title="Terms of use">
      <p>
        Last updated: <Fill>date</Fill>
      </p>

      <h2>Who we are</h2>
      <p>
        <Fill>Legal entity name, registration number, VAT number if registered</Fill>,{' '}
        <Fill>physical address</Fill>, <Fill>email and phone</Fill>. These details are
        shown as required by s43 of South Africa’s Electronic Communications and
        Transactions Act.
      </p>

      <h2>What StayScout is</h2>
      <p>
        A planning aid. It suggests places within 50 km straight-line distance of your
        confirmed accommodation and arranges them into a schedule. It does not make
        bookings or reservations, and booking links go to each venue’s own site.
      </p>

      <h2>Accuracy</h2>
      <p>
        Opening hours, prices and other details come from third-party sources, are shown
        with their source and check date where available, and can change. Visit durations
        and travel times are estimates, not live traffic. Please confirm with each venue
        before you travel.
      </p>

      <h2>Safety</h2>
      <p>
        StayScout does not assess or guarantee safety. The absence of a warning is not
        evidence that a place or activity is safe. Check official travel advice and local
        conditions.
      </p>

      <h2>The complete guide: price, payment and cancellation</h2>
      <ul>
        <li>
          The complete guide costs the price shown at checkout, one-time, paid through
          PayPal.{' '}
          <Fill>
            State whether the price includes VAT, and register for VAT on electronic
            services where required.
          </Fill>
        </li>
        <li>
          It is digital content supplied immediately. Before paying you ask us to unlock
          it straight away and confirm that you then lose the 14-day right to cancel that
          consumers in the EU and UK otherwise have. We record when you confirmed this.
        </li>
        <li>
          If the guide doesn’t work as described, contact us and we will fix it or refund
          you.{' '}
          <Fill>
            Refund policy and how to request one; check the cooling-off and refund rules
            under South Africa’s ECTA s44 and Consumer Protection Act with counsel.
          </Fill>
        </li>
        <li>A refunded guide returns to preview mode.</li>
      </ul>

      <h2>Acceptable use</h2>
      <p>
        Don’t attempt to access trips that aren’t yours, overload the service, or scrape
        place data. Place data may be subject to the provider’s own terms.
      </p>

      <h2>Liability</h2>
      <p>
        <Fill>
          Limitation of liability, as advised by counsel. Consumer rights that cannot be
          excluded by law are not affected.
        </Fill>
      </p>

      <h2>Governing law and disputes</h2>
      <p>
        <Fill>
          Governing law and forum; for EU/UK consumers, their local mandatory rights
          apply.
        </Fill>
      </p>
    </Legal>
  )
}
