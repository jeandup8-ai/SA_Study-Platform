import type { ReactNode } from 'react'
import { MarketingShell } from '@/components/layout/MarketingShell'
import { Badge } from '@/components/ui'

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
    <MarketingShell>
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-extrabold text-slate-900">{title}</h1>
          {draft && <Badge tone="warning">Draft — pending legal review</Badge>}
        </div>
        <p className="mt-2 text-sm text-slate-400">Last updated: {lastUpdated}</p>
        <div
          className="mt-8 space-y-4 text-slate-700
            [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-slate-900
            [&_h2:first-child]:mt-0
            [&_p]:leading-relaxed
            [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6
            [&_strong]:font-semibold [&_strong]:text-slate-900
            [&_a]:font-semibold [&_a]:text-brand-700 [&_a]:underline"
        >
          {children}
        </div>
      </div>
    </MarketingShell>
  )
}
