import { useTranslation } from 'react-i18next'

/** Renders an admin-approved external video for a topic. Uses
 * youtube-nocookie.com (privacy-enhanced mode) to avoid setting tracking
 * cookies until playback starts, but this still hands the learner off to
 * YouTube's player -- end-of-video suggestions and the channel's own related
 * content are outside our control, hence the disclaimer below. */
export function TopicVideoPanel({ youtubeVideoId, title }: { youtubeVideoId: string; title: string }) {
  const { t } = useTranslation()
  return (
    <div className="mt-3">
      <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
        <iframe
          className="h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${youtubeVideoId}`}
          title={title}
          allow="encrypted-media"
          allowFullScreen
        />
      </div>
      <p className="mt-2 text-xs text-slate-400">{t('lesson.videoDisclaimer')}</p>
    </div>
  )
}
