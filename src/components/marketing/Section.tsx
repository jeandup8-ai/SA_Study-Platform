import type { ReactNode } from 'react'
import clsx from 'clsx'
import { Reveal } from './Reveal'

/**
 * One full-width band of the page.
 *
 * `tone` carries the page's rhythm: the site alternates between dark
 * (product, story, emotion) and light (parent-facing, detail, trust), which
 * is what stops a long scroll from reading as one endless gradient.
 */
export function Section({
  children,
  tone = 'dark',
  id,
  className,
}: {
  children: ReactNode
  tone?: 'dark' | 'darker' | 'light' | 'white'
  id?: string
  className?: string
}) {
  const toneClasses = {
    dark: 'bg-ink-900 text-white',
    darker: 'bg-ink-950 text-white',
    light: 'bg-ink-50 text-ink-900',
    white: 'bg-white text-ink-900',
  }[tone]

  return (
    <section id={id} className={clsx('relative overflow-hidden', toneClasses, className)}>
      {/* 16px side gutter on phones, widening with the viewport. */}
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">{children}</div>
    </section>
  )
}

export function Eyebrow({ children, tone = 'dark' }: { children: ReactNode; tone?: 'dark' | 'light' }) {
  return (
    <p
      className={clsx(
        'text-xs font-extrabold uppercase tracking-[0.18em]',
        tone === 'dark' ? 'text-volt-300' : 'text-volt-700',
      )}
    >
      {children}
    </p>
  )
}

/**
 * Section headline. Display type is set very large and very tight, which is
 * where most of the site's "premium" read comes from -- it is the one place
 * the design spends scale freely.
 */
export function SectionHeading({
  eyebrow,
  title,
  lead,
  tone = 'dark',
  align = 'left',
  className,
}: {
  eyebrow?: string
  title: ReactNode
  lead?: ReactNode
  tone?: 'dark' | 'light'
  align?: 'left' | 'center'
  className?: string
}) {
  return (
    <Reveal className={clsx(align === 'center' && 'mx-auto text-center', 'max-w-3xl', className)}>
      {eyebrow && <Eyebrow tone={tone}>{eyebrow}</Eyebrow>}
      <h2
        className={clsx(
          'font-display text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-5xl lg:text-6xl',
          eyebrow && 'mt-3',
          tone === 'dark' ? 'text-white' : 'text-ink-900',
        )}
      >
        {title}
      </h2>
      {lead && (
        <p
          className={clsx(
            'mt-5 text-lg leading-relaxed sm:text-xl',
            tone === 'dark' ? 'text-ink-200' : 'text-ink-500',
          )}
        >
          {lead}
        </p>
      )}
    </Reveal>
  )
}
