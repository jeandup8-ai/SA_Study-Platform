import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { TripView } from '../../../shared/types'
import { api, type TripSummary } from '../api'
import { GuideView, SafetyPanelView, fmtDate } from '../components/GuideView'
import { PlaceCard } from '../components/PlaceCard'
import {
  EmptyState,
  ErrorNotice,
  SampleBanner,
  SampleTag,
  Spinner,
  useNoIndex,
  usePageTitle,
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
  const load = () => {
    setError(null)
    api.sample().then(setTrip, setError)
  }
  useEffect(load, [])
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
  const load = () => {
    setError(null)
    api.listTrips().then((r) => setTrips(r.trips), setError)
  }
  useEffect(load, [])
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

export function Privacy() {
  return (
    <Legal title="Privacy">
      <h2>What we collect</h2>
      <ul>
        <li>
          Your chosen accommodation (name, address, coordinates from our place-data
          provider).
        </li>
        <li>
          Trip preferences you enter: dates, number of adults, children’s age ranges
          (never names or birth dates), interests, pace, transport, budget and any
          optional notes.
        </li>
        <li>The places you select and the plan we build.</li>
        <li>
          A random identifier stored in a cookie so this browser can reopen its trips. We
          store only a one-way hash of it.
        </li>
        <li>
          If you pay: an order reference and status from PayPal. We never see or store
          card details.
        </li>
      </ul>
      <h2>What we use it for</h2>
      <p>
        Only to build, save and show your guide, and to confirm payment. We do not sell
        your data or use it for advertising.
      </p>
      <h2>Who else processes it</h2>
      <p>
        Depending on configuration: our place-data provider (e.g. Google Places) receives
        your accommodation search and its location; an AI provider (e.g. Anthropic) may
        receive your preferences and the list of nearby places to arrange a plan, without
        your identity; PayPal processes payments.
      </p>
      <h2>Sharing</h2>
      <p>
        If you create a share link, anyone with it can view your plan (not your
        preferences). You can turn it off at any time.
      </p>
      <h2>Your choices</h2>
      <p>
        You can download your trip data as JSON or delete a trip permanently from its
        page. Clearing this site’s cookies removes your browser’s access to its trips.
      </p>
      <h2>Contact</h2>
      <p>[Operator to add contact details.]</p>
    </Legal>
  )
}

export function Terms() {
  return (
    <Legal title="Terms">
      <h2>What StayScout is</h2>
      <p>
        A planning aid. It suggests places within 50 km straight-line distance of your
        confirmed accommodation and arranges them into a schedule. It does not make
        bookings or reservations.
      </p>
      <h2>Accuracy</h2>
      <p>
        Opening hours, prices and other details come from third-party sources, are shown
        with their source and check date where available, and can change. Durations and
        travel times are estimates. Always confirm with the venue before you travel.
      </p>
      <h2>Safety</h2>
      <p>
        StayScout does not assess or guarantee safety. The absence of a warning is not
        evidence that a place or activity is safe. Check official travel advice and local
        conditions.
      </p>
      <h2>Payments</h2>
      <p>
        The complete guide is a one-time digital purchase. [Operator to add refund
        policy.]
      </p>
      <h2>Contact</h2>
      <p>[Operator to add contact details.]</p>
    </Legal>
  )
}
