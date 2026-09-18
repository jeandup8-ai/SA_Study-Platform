import { useTranslation } from 'react-i18next'
import { BookOpen, Clock, PenLine, TriangleAlert } from 'lucide-react'
import {
  MasteryRing,
  Reveal,
  Section,
  SectionHeading,
  StatTile,
  SubjectRow,
} from '@/components/marketing'

/**
 * Progress, shown as the product shows it.
 *
 * Deliberately no vanity numbers: every figure here is something a parent can
 * act on -- which subject is strong, which topics need another pass, how much
 * was actually practised. The values are an illustrative sample learner, not
 * an aggregate claim about results.
 */
export function Progress() {
  const { t } = useTranslation()

  return (
    <Section tone="light">
      <SectionHeading
        eyebrow={t('m.progress.eyebrow')}
        title={t('m.progress.title')}
        lead={t('m.progress.lead')}
        tone="light"
        align="center"
      />

      <Reveal className="mt-14">
        <div className="overflow-hidden rounded-[2rem] border border-ink-100 bg-white shadow-[0_30px_80px_-40px_rgba(12,20,36,0.35)]">
          {/* Dashboard chrome, so the panel reads as a screen rather than a card. */}
          <div className="flex items-center gap-2 border-b border-ink-100 bg-ink-50/70 px-5 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-ink-200" />
            <span className="h-2.5 w-2.5 rounded-full bg-ink-200" />
            <span className="h-2.5 w-2.5 rounded-full bg-ink-200" />
            <p className="ml-3 text-xs font-bold text-ink-400">{t('m.progress.panelTitle')}</p>
          </div>

          <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-ink-100 bg-ink-50/60 p-4">
                <MasteryRing
                  value={76}
                  size={92}
                  label={t('m.progress.overallLabel')}
                  sublabel={t('m.progress.overallSub')}
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <StatTile label={t('m.progress.stat.lessons')} value="34" icon={BookOpen} />
                <StatTile label={t('m.progress.stat.questions')} value="412" icon={PenLine} />
                <StatTile label={t('m.progress.stat.time')} value="9h 20m" icon={Clock} />
                <StatTile label={t('m.progress.stat.streak')} value="6" icon={PenLine} />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink-400">
                  {t('m.progress.bySubject')}
                </p>
                <div className="mt-3 space-y-2.5">
                  <SubjectRow name={t('m.subject.mathematics')} mastery={78} />
                  <SubjectRow name={t('m.subject.englishHl')} mastery={82} />
                  <SubjectRow name={t('m.subject.socialSciences')} mastery={71} />
                  <SubjectRow name={t('m.subject.naturalSciences')} mastery={58} attention />
                </div>
              </div>

              {/* The most useful panel for a parent: what to do next. */}
              <div className="rounded-2xl border border-gold-200 bg-gold-50 p-4">
                <div className="flex items-center gap-2">
                  <TriangleAlert size={15} className="text-gold-600" />
                  <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-gold-600">
                    {t('m.progress.attentionLabel')}
                  </p>
                </div>
                <ul className="mt-2.5 space-y-1.5">
                  {['a', 'b'].map((key) => (
                    <li key={key} className="text-sm font-semibold text-ink-700">
                      {t(`m.progress.attention.${key}`)}
                    </li>
                  ))}
                </ul>
                <p className="mt-2.5 text-xs leading-relaxed text-ink-500">
                  {t('m.progress.attentionNote')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      <Reveal delay={150}>
        <p className="mt-6 text-center text-xs text-ink-400">{t('m.progress.sampleNote')}</p>
      </Reveal>
    </Section>
  )
}
