import { Link } from 'react-router-dom'
import { RingIcon } from '../components/ui'
import { RADIUS_NOTICE, usePageTitle, useStatus } from '../lib'

function HeroArt() {
  // Original line art: contour rings around a stay, echoing the 50 km circle.
  return (
    <svg viewBox="0 0 400 400" className="h-full w-full" aria-hidden>
      <defs>
        <radialGradient id="glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#e9a27c" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#e9a27c" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="200" cy="200" r="190" fill="url(#glow)" />
      {[40, 75, 110, 145, 180].map((r, i) => (
        <circle
          key={r}
          cx="200"
          cy="200"
          r={r}
          fill="none"
          stroke="#0f5e5a"
          strokeOpacity={0.15 + i * 0.12}
          strokeWidth={i === 4 ? 2 : 1}
          strokeDasharray={i === 4 ? '6 6' : undefined}
        />
      ))}
      <path
        d="M40 260 C110 220 150 300 220 260 S330 210 370 240"
        fill="none"
        stroke="#0f5e5a"
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />
      <path
        d="M60 140 C120 110 170 170 230 140 S320 100 350 130"
        fill="none"
        stroke="#0f5e5a"
        strokeOpacity="0.25"
        strokeWidth="1.5"
      />
      {[
        [120, 150],
        [270, 120],
        [300, 250],
        [150, 290],
        [215, 85],
        [95, 225],
        [255, 300],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="5" fill="#a8461f" />
      ))}
      <circle cx="200" cy="200" r="11" fill="#1c1917" stroke="#faf7f2" strokeWidth="3" />
      <text
        x="200"
        y="372"
        textAnchor="middle"
        fontFamily="Inter, sans-serif"
        fontSize="13"
        fill="#0a4441"
        letterSpacing="2"
      >
        50 KM
      </text>
    </svg>
  )
}

export function Landing() {
  usePageTitle('')
  const status = useStatus()
  const price = status?.payments.price
  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-12 pt-10 sm:px-6 md:grid-cols-[1.1fr_0.9fr] md:pt-16">
        <div className="fade-in">
          <p className="eyebrow">Accommodation-first holiday planning</p>
          <h1 className="mt-3 font-display text-4xl leading-[1.08] sm:text-5xl lg:text-6xl">
            Your stay is booked.{' '}
            <span className="text-sea">Now make the most of it.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            Tell StayScout where you’re staying. We find worthwhile things to do within 50
            km, you choose what appeals, and we turn it into a day-by-day plan that fits
            your dates, pace and budget.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/plan" className="btn btn-primary !px-6 text-base">
              Plan my stay
            </Link>
            <Link to="/sample" className="btn btn-secondary !px-6 text-base">
              See a sample guide
            </Link>
          </div>
        </div>
        <div className="mx-auto aspect-square w-full max-w-sm md:max-w-none">
          <HeroArt />
        </div>
      </section>

      <section className="border-y border-line bg-sand/60">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
          {[
            [
              'Start from your bed, not a city centre',
              'Most guides start from a city. Your days start from your hotel, resort or lodge — so every distance in your plan is measured from there.',
            ],
            [
              'A firm 50 km circle',
              'Every included place is within 50 km in a straight line of your confirmed stay. We check that on our own servers, every time your plan changes.',
            ],
            [
              'Honest about what we know',
              'Each detail shows where it came from and when it was checked. Estimates are labelled. Missing information is shown as missing, not guessed.',
            ],
          ].map(([t, d]) => (
            <div key={t}>
              <RingIcon className="h-6 w-6 text-sea" />
              <h2 className="mt-3 font-display text-xl">{t}</h2>
              <p className="mt-2 text-muted">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="font-display text-3xl">How it works</h2>
        <ol className="mt-8 grid gap-6 md:grid-cols-4">
          {[
            ['Find your stay', 'Search by property name and confirm the exact location.'],
            [
              'Tell us about the trip',
              'Dates, who’s coming, pace, interests and budget. Optional questions can be skipped.',
            ],
            [
              'Choose what appeals',
              'Browse places in range by category, cost, distance and indoor or outdoor.',
            ],
            [
              'Get your plan',
              'A practical day-by-day schedule you can edit, regenerate a day at a time, share and print.',
            ],
          ].map(([t, d], i) => (
            <li key={t} className="card p-5">
              <p className="font-display text-3xl text-coral">{i + 1}</p>
              <h3 className="mt-2 font-semibold">{t}</h3>
              <p className="mt-1 text-sm text-muted">{d}</p>
            </li>
          ))}
        </ol>
        <p className="mt-8 max-w-3xl text-sm text-muted">{RADIUS_NOTICE}</p>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 sm:px-6 md:grid-cols-2">
        <div className="card p-6">
          <h2 className="font-display text-2xl">
            Safety information, without false comfort
          </h2>
          <p className="mt-3 text-muted">
            Where we can, we link the official travel advice we actually checked, with its
            date. We don’t invent safety scores or call places “safe”. If we couldn’t
            check, we say so and point you to official sources.
          </p>
        </div>
        <div className="card p-6">
          <h2 className="font-display text-2xl">What’s free, what’s paid</h2>
          <ul className="mt-3 space-y-2 text-muted">
            <li>
              <strong className="text-ink">Free:</strong> find your stay, browse places in
              range, and preview the first day of your plan.
            </li>
            <li>
              <strong className="text-ink">
                Complete guide
                {price ? ` — ${price.currency} ${price.amount}, one-time` : ''}:
              </strong>{' '}
              every day of your plan, PDF export and a share link.
            </li>
            {status?.payments.mode === 'off' && (
              <li className="text-sm">
                Payments aren’t switched on in this environment, so the complete guide is
                unlocked for everyone.
              </li>
            )}
            <li className="text-sm">
              We never book anything for you. Booking links go to each venue’s own site.
            </li>
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-14 sm:px-6">
        <div className="card flex flex-col items-start justify-between gap-4 bg-sea p-8 text-paper md:flex-row md:items-center">
          <div>
            <h2 className="font-display text-3xl">See it before you start</h2>
            <p className="mt-2 text-paper/85">
              Explore a complete sample guide for a fictional resort — no account needed.
            </p>
          </div>
          <Link to="/sample" className="btn bg-paper text-sea-deep hover:bg-sand">
            Open the sample guide
          </Link>
        </div>
      </section>
    </>
  )
}
