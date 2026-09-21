import type { ReactNode } from 'react'
import clsx from 'clsx'
import { Reveal } from './Reveal'

/**
 * The opening band of every public page that is not the landing page.
 *
 * The landing page paints its own hero, but pricing, the legal pages and the
 * free practice tests each used to open with a small dark-on-white heading in
 * a narrow container. Next to the landing page they read as a different
 * product. This gives them the same opening: ink canvas, the CSS grid and
 * glows, an eyebrow, and the display face at a size the rest of the site
 * actually uses.
 *
 * Deliberately smaller than the landing hero -- that one is the argument for
 * the product and earns its scale; these are the top of a page you have
 * already chosen to be on.
 */
export function PageHero({
  eyebrow,
  title,
  lead,
  above,
  aside,
  children,
  className,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  lead?: ReactNode
  /** Breadcrumbs or similar, sitting above the title. */
  above?: ReactNode
  /** Right-hand slot -- the language toggle on the practice pages. */
  aside?: ReactNode
  /** Anything below the lead, such as a row of promises. */
  children?: ReactNode
  className?: string
}) {
  return (
    <section className={clsx('relative overflow-hidden bg-ink-950', className)}>
      <div className="bg-grid absolute inset-0 opacity-40" aria-hidden />
      <div
        className="glow-volt absolute -left-32 -top-40 h-[30rem] w-[30rem] opacity-60"
        aria-hidden
      />
      <div
        className="glow-lilac absolute -bottom-44 right-[-8rem] h-[26rem] w-[26rem] opacity-40"
        aria-hidden
      />

      <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-10 sm:px-6 sm:pb-20 sm:pt-14">
        {above && <div className="mb-6">{above}</div>}

        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 max-w-3xl">
            {eyebrow && (
              <Reveal>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-volt-300">
                  {eyebrow}
                </p>
              </Reveal>
            )}
            <Reveal delay={70}>
              <h1
                className={clsx(
                  'font-display text-4xl font-extrabold leading-[1.02] tracking-tight text-white sm:text-5xl lg:text-6xl',
                  eyebrow && 'mt-3',
                )}
              >
                {title}
              </h1>
            </Reveal>
            {lead && (
              <Reveal delay={140}>
                <p className="mt-5 text-lg leading-relaxed text-ink-200 sm:text-xl">
                  {lead}
                </p>
              </Reveal>
            )}
          </div>
          {aside && <div className="shrink-0">{aside}</div>}
        </div>

        {children && <Reveal delay={200}>{children}</Reveal>}
      </div>
    </section>
  )
}
