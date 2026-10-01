import type { ComponentType, ReactNode } from 'react'
import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Database } from '@/types/database'
import type { GuidedHelpState } from '@/hooks/useGuidedHelp'
import { AlternateExplanationCard } from './AlternateExplanationCard'
import { MindMapView } from './MindMapView'
import { TopicVideoPanel } from './TopicVideoPanel'

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
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-brand-200 bg-white px-4 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 active:bg-brand-100"
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

/**
 * Whatever the Guided help actions produced, rendered inside the region
 * that offered them so a result is never orphaned from its request.
 *
 * Each of the three is independent: an explanation, a mind map and a video
 * can all be open at once, because a learner who asked for all three
 * probably wants to see all three.
 */
export function GuidedHelpResults({
  help,
  video,
}: {
  help: GuidedHelpState
  video: Database['public']['Tables']['topic_videos']['Row'] | null
}) {
  const { t } = useTranslation()

  return (
    <>
      <PendingOrError
        loading={help.explanationLoading}
        loadingLabel={t('lesson.aiExplanationLoading')}
        error={
          help.explanationError && t(`lesson.aiExplanationError.${help.explanationError}`)
        }
      />
      {/* Hidden while a fresh request is in flight or has failed. The two
          panels this replaced were exclusive -- loading, or error, or the
          result -- and re-asking while an old answer was on screen must not
          show the learner the previous explanation under a spinner. */}
      {!help.explanationLoading && !help.explanationError && help.explanation && (
        <AlternateExplanationCard explanation={help.explanation} />
      )}

      <PendingOrError
        loading={help.mindMapLoading}
        loadingLabel={t('lesson.mindMapLoading')}
        error={help.mindMapError && t(`lesson.mindMapError.${help.mindMapError}`)}
      />
      {!help.mindMapLoading && !help.mindMapError && help.mindMap && (
        <MindMapView mindmap={help.mindMap} />
      )}

      {help.videoOpen && video && (
        <TopicVideoPanel youtubeVideoId={video.youtube_video_id} title={video.title} />
      )}
    </>
  )
}

/**
 * The waiting and failed states shared by every Guided help request. Both
 * panels had their own copy of this, differing only in which translation
 * key they read.
 */
function PendingOrError({
  loading,
  loadingLabel,
  error,
}: {
  loading: boolean
  loadingLabel: string
  error: string | null | false
}) {
  if (loading) {
    return (
      <p role="status" className="mt-3 flex items-center gap-2 text-sm text-slate-500">
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600 motion-reduce:animate-none"
          aria-hidden
        />
        {loadingLabel}
      </p>
    )
  }
  if (error) return <p className="mt-3 text-sm text-slate-500">{error}</p>
  return null
}
