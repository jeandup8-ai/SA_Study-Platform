import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * The last line of defence between a thrown render error and a white screen.
 *
 * Without one of these, React 19 unmounts the entire tree when any component
 * throws during render. The child is left looking at a blank page with no
 * message, no way back, and nothing to tell a parent whether the product is
 * broken or their internet is. For a paid product used by nine-year-olds
 * that is the worst possible failure mode, and it was reachable from every
 * route.
 *
 * The second, likelier trigger is a deploy. Routes are code-split with
 * `lazy()`, so an open tab holding the previous build asks for chunk
 * filenames that no longer exist; the dynamic import rejects, and the
 * Suspense boundary above it has nothing to catch with. That is why a chunk
 * failure gets its own message and a reload button rather than the generic
 * one -- reloading genuinely fixes it, and telling someone to reload is only
 * useful if you say so.
 *
 * Deliberately not a reporting hook. There is no error-tracking service
 * configured in this project, and inventing a network call to one that does
 * not exist would be worse than logging to the console.
 */

interface Props {
  children: ReactNode
  /** Shown instead of the default panel, for boundaries around one widget. */
  fallback?: (reset: () => void) => ReactNode
}

interface State {
  error: Error | null
}

/** A failed `lazy()` import after a deploy, as opposed to a real bug. */
function isChunkLoadError(error: Error): boolean {
  const message = `${error.name} ${error.message}`
  return (
    /ChunkLoadError/i.test(message) ||
    /Loading chunk .* failed/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message)
  )
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // The only place the stack survives. Without it a production error is
    // invisible to anyone who did not reproduce it with the devtools open.
    console.error('Unhandled render error:', error, info.componentStack)
  }

  reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    if (this.props.fallback) return this.props.fallback(this.reset)

    const stale = isChunkLoadError(error)

    return (
      // Deliberately plain: this has to render when something in the app is
      // already broken, so it uses no context, no translations, no router
      // and no component from the design system. t() needs i18n to have
      // initialised, and a boundary that itself throws shows nothing at all.
      <div
        role="alert"
        className="app-canvas flex min-h-dvh items-center justify-center px-4 py-10"
      >
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-4xl" aria-hidden>
            {stale ? '🔄' : '😕'}
          </p>
          <h1 className="mt-3 font-display text-xl font-extrabold text-slate-900">
            {stale ? 'A new version is ready' : 'Something went wrong'}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {stale
              ? 'StudyLegends was updated while this page was open. Reload to get the new version — nothing you have done has been lost.'
              : 'This page could not load properly. It is not something you did, and your progress is safe.'}
          </p>

          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-11 rounded-full bg-volt-500 px-5 font-bold text-ink-950 hover:bg-volt-400"
            >
              Reload the page
            </button>
            {!stale && (
              <a
                href="/"
                className="min-h-11 rounded-full px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Go to the home page
              </a>
            )}
          </div>

          <p className="mt-4 text-xs text-slate-400">
            If this keeps happening, contact us at{' '}
            <a className="underline" href="/contact">
              studylegends.co.za/contact
            </a>
            .
          </p>
        </div>
      </div>
    )
  }
}
