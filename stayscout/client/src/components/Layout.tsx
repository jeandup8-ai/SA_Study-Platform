import { Link, NavLink, Outlet } from 'react-router-dom'
import { RingIcon, useStatus } from './ui'

export function Layout() {
  const status = useStatus()
  const navCls = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-3 py-2 text-sm font-medium ${isActive ? 'bg-sand text-ink' : 'text-muted hover:text-ink'}`
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
      >
        Skip to content
      </a>
      <header className="border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2 font-display text-xl text-ink">
            <RingIcon className="h-7 w-7 text-sea" />
            StayScout
          </Link>
          <nav aria-label="Main" className="flex items-center gap-1">
            <NavLink to="/sample" className={navCls}>
              Sample guide
            </NavLink>
            <NavLink to="/trips" end className={navCls}>
              My trips
            </NavLink>
            <Link to="/plan" className="btn btn-primary !min-h-10 !px-4 !py-2 text-sm">
              Plan my stay
            </Link>
          </nav>
        </div>
      </header>
      {status && status.places.mode === 'demo' && (
        <div className="border-b border-amber-ink/15 bg-amber-soft text-amber-ink">
          <p className="mx-auto max-w-6xl px-4 py-2 text-sm sm:px-6">
            <strong>Demo mode:</strong> no live place search is configured, so StayScout
            uses clearly labelled sample data for a fictional destination.
          </p>
        </div>
      )}
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <footer className="mt-16 border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm text-muted sm:grid-cols-[1fr_auto] sm:px-6">
          <div>
            <p className="font-display text-base text-ink">StayScout</p>
            <p className="mt-1 max-w-md">
              Things to do within 50 km of where you’re staying. Estimates are labelled as
              estimates; nothing is booked on your behalf.
            </p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-4">
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/sample">Sample guide</Link>
          </nav>
          {status && (
            <p className="text-xs sm:col-span-2" aria-label="Service status">
              Data:{' '}
              {status.places.mode === 'demo'
                ? 'sample (demo)'
                : `live (${status.places.provider})`}{' '}
              · AI planner: {status.ai.mode} · Payments: {status.payments.mode} · Safety
              sources: {status.safety.mode} · Storage:{' '}
              {status.storage === 'memory' ? 'temporary (in-memory)' : 'database'}
            </p>
          )}
        </div>
      </footer>
    </div>
  )
}
