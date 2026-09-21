import type { ReactNode } from 'react'
import { MarketingShell } from '@/components/layout/MarketingShell'
import { PageHero, Section } from '@/components/marketing'

/**
 * Shared chrome for /terms, /privacy, /refund-policy, /subscription-cancellation,
 * /contact. `draft` marks pages whose legal content has not yet been reviewed by
 * a qualified attorney — every page created for the initial PayFast-preparation
 * pass sets it, since none of them have had that review yet.
 */
export function LegalPageLayout({
  title,
  lastUpdated,
  draft = true,
  children,
}: {
  title: string
  lastUpdated: string
  draft?: boolean
  children: ReactNode
}) {
  return (
    <MarketingShell surface="dark">
      <PageHero
        eyebrow={`Last updated: ${lastUpdated}`}
        title={title}
        aside={
          draft ? (
            <span className="inline-flex items-center rounded-full border border-gold-400/30 bg-gold-400/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-gold-300">
              Draft — pending legal review
            </span>
          ) : undefined
        }
      />

      <Section tone="white">
        {/* Prose is capped at a readable measure inside the wider section
            container, rather than the whole page being narrow -- that keeps
            the header and footer aligned with every other page. Left-aligned
            rather than centred so the body starts on the same gutter as the
            page title above it. */}
        <div
          className="max-w-3xl space-y-4 text-ink-700
            [&_h2]:font-display [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-extrabold [&_h2]:tracking-tight [&_h2]:text-ink-900
            [&_h2:first-child]:mt-0
            [&_p]:leading-relaxed
            [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6
            [&_strong]:font-semibold [&_strong]:text-ink-900
            [&_a]:font-semibold [&_a]:text-volt-700 [&_a]:underline"
        >
          {children}
        </div>
      </Section>
    </MarketingShell>
  )
}
