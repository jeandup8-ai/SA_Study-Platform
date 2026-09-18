import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { Lightbulb, Shapes, SquarePen, HandMetal, Repeat2, ShieldCheck } from 'lucide-react'
import { Reveal, Section, SectionHeading, TutorTurn } from '@/components/marketing'

/**
 * The AI tutor, positioned honestly.
 *
 * The product commitment is that the tutor explains rather than answers, and
 * this section has to carry that or the whole thing reads as a homework
 * cheating tool. The ladder on the right is the order the tutor actually
 * works in: explain, show, work through, hand over, then practise.
 */
const LADDER = [
  { key: 'explanation', icon: Lightbulb },
  { key: 'visual', icon: Shapes },
  { key: 'worked', icon: SquarePen },
  { key: 'tryIt', icon: HandMetal },
  { key: 'practice', icon: Repeat2 },
] as const

export function AiTutor() {
  const { t } = useTranslation()

  return (
    <Section tone="darker">
      <div className="glow-lilac pointer-events-none absolute -right-40 top-0 h-[28rem] w-[28rem] opacity-40" aria-hidden />

      <div className="relative">
        <SectionHeading
          eyebrow={t('m.tutorSection.eyebrow')}
          title={
            <>
              {t('m.tutorSection.titleLine1')}
              <br />
              <span className="text-volt-300">{t('m.tutorSection.titleLine2')}</span>
            </>
          }
          lead={t('m.tutorSection.lead')}
        />

        <div className="mt-14 grid gap-8 lg:grid-cols-2 lg:gap-14">
          <Reveal>
            <div className="rounded-[1.75rem] border border-white/10 bg-ink-950/60 p-5 sm:p-7">
              <div className="space-y-3">
                <TutorTurn from="learner">{t('m.tutor.learnerAsk')}</TutorTurn>
                <TutorTurn from="tutor">{t('m.tutor.reply1')}</TutorTurn>
                <TutorTurn from="tutor">{t('m.tutor.reply2')}</TutorTurn>
                <TutorTurn from="tutor">{t('m.tutor.reply3')}</TutorTurn>
                <TutorTurn from="learner">{t('m.tutor.learnerTry')}</TutorTurn>
                <TutorTurn from="tutor">{t('m.tutor.reply4')}</TutorTurn>
              </div>

              {/* The commitment, stated where the conversation is visible. */}
              <div className="mt-6 flex gap-3 rounded-2xl border border-volt-400/20 bg-volt-400/[0.07] p-4">
                <ShieldCheck size={18} className="mt-0.5 shrink-0 text-volt-300" />
                <p className="text-sm leading-relaxed text-ink-200">
                  {t('m.tutorSection.commitment')}
                </p>
              </div>
            </div>
          </Reveal>

          <div>
            <ol className="space-y-3">
              {LADDER.map(({ key, icon: Icon }, index) => (
                <Reveal as="li" key={key} delay={index * 90}>
                  <div className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
                    <span
                      className={clsx(
                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl',
                        index === LADDER.length - 1
                          ? 'bg-gold-300/20 text-gold-200'
                          : 'bg-volt-400/15 text-volt-200',
                      )}
                    >
                      <Icon size={19} />
                    </span>
                    <div className="min-w-0">
                      <p className="font-display text-base font-extrabold tracking-tight text-white">
                        {t(`m.tutorSection.ladder.${key}.title`)}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-ink-300">
                        {t(`m.tutorSection.ladder.${key}.body`)}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </Section>
  )
}
