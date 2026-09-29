import type { ComponentType, ReactNode } from 'react'
import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/**
 * The learner-facing surface of the AI features, given one identity.
 *
 * Before this, the "explain a different way", "show me an example",
 * "mind map" and "watch a video" actions were four loose pills sitting at
 * the bottom of an explanation card, indistinguishable from any other
 * button on the page. Nothing said they belonged together, and nothing
 * said what they were.
 *
 * They are now one named region. The name is deliberately the one the
 * marketing site already uses -- "Guided help" / "Begeleide hulp" -- rather
 * than a second name invented for the app, so a parent who read the site
 * recognises the thing their child is using.
 *
 * Anything the actions produce (an alternate explanation, a mind map, a
 * video) renders inside the region as `children`, so a result always
 * appears attached to the thing that asked for it.
 */

export interface GuidedHelpAction {
  key: string
  icon: ComponentType<{ size?: number | string }>
  label: string
  onClick: () => void
}

export function GuidedHelp({
  actions,
  children,
}: {
  actions: GuidedHelpAction[]
  children?: ReactNode
}) {
  const { t } = useTranslation()
  if (actions.length === 0) return null

  return (
    <section
      aria-label={t('lesson.guidedHelp')}
      className="mt-5 rounded-card border border-brand-100 bg-brand-50/60 p-3"
    >
      <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-[0.12em] text-brand-700">
        <Sparkles size={13} aria-hidden />
        {t('lesson.guidedHelp')}
      </p>

      <div className="mt-2.5 flex flex-wrap gap-2">
        {actions.map(({ key, icon: Icon, label, onClick }) => (
          <button
            key={key}
            type="button"
            onClick={onClick}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-brand-200 bg-white px-3.5 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 active:bg-brand-100"
          >
            <Icon size={14} aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {children}
    </section>
  )
}
