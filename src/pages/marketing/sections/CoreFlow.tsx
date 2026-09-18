import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import {
  MasteryRing,
  PracticeCard,
  Reveal,
  ScanCard,
  Section,
  SectionHeading,
  SubjectRow,
  TutorTurn,
} from '@/components/marketing'

/**
 * The core loop, in the order a learner lives it.
 *
 * Each step pairs the promise with the actual interface that delivers it, so
 * a parent reading this section has already seen the product before they
 * reach the pricing.
 */
export function CoreFlow() {
  const { t } = useTranslation()

  const steps = [
    { key: 'snap', visual: <SnapVisual /> },
    { key: 'understand', visual: <UnderstandVisual /> },
    { key: 'practise', visual: <PractiseVisual /> },
    { key: 'master', visual: <MasterVisual /> },
  ] as const

  return (
    <Section tone="white" id="how-it-works">
      <SectionHeading
        eyebrow={t('m.flow.eyebrow')}
        title={t('m.flow.title')}
        lead={t('m.flow.lead')}
        tone="light"
        align="center"
      />

      <ol className="mt-16 space-y-6 lg:space-y-8">
        {steps.map(({ key, visual }, index) => (
          <Reveal as="li" key={key} delay={index * 90}>
            <div
              className={clsx(
                'grid items-center gap-8 rounded-[2rem] border border-ink-100 bg-ink-50/60 p-6 sm:p-9',
                'lg:grid-cols-2 lg:gap-14',
              )}
            >
              <div className={clsx(index % 2 === 1 && 'lg:order-2')}>
                <span className="font-display text-5xl font-extrabold leading-none text-volt-500/25 sm:text-6xl">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-3 font-display text-2xl font-extrabold uppercase tracking-tight text-ink-900 sm:text-3xl">
                  {t(`m.flow.step.${key}.title`)}
                </h3>
                <p className="mt-3 max-w-md text-base leading-relaxed text-ink-500 sm:text-lg">
                  {t(`m.flow.step.${key}.body`)}
                </p>
              </div>
              <div className={clsx('mx-auto w-full max-w-sm', index % 2 === 1 && 'lg:order-1')}>
                {visual}
              </div>
            </div>
          </Reveal>
        ))}
      </ol>
    </Section>
  )
}

/** Each visual sits on the same white panel so the four read as one product. */
function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-2.5 rounded-3xl border border-ink-100 bg-white p-4 shadow-[0_18px_50px_-24px_rgba(12,20,36,0.3)]">
      {children}
    </div>
  )
}

function SnapVisual() {
  const { t } = useTranslation()
  return (
    <Panel>
      <ScanCard caption={t('m.flow.scan.caption')} detected={t('m.flow.scan.detected')} />
    </Panel>
  )
}

function UnderstandVisual() {
  const { t } = useTranslation()
  return (
    <Panel>
      <TutorTurn from="learner">{t('m.tutor.learnerAsk')}</TutorTurn>
      <TutorTurn from="tutor">{t('m.tutor.reply1')}</TutorTurn>
      <TutorTurn from="tutor">{t('m.tutor.reply2')}</TutorTurn>
    </Panel>
  )
}

function PractiseVisual() {
  const { t } = useTranslation()
  return (
    <Panel>
      <PracticeCard
        prompt={t('m.practice.prompt')}
        options={[
          t('m.practice.optionA'),
          t('m.practice.optionB'),
          t('m.practice.optionC'),
          t('m.practice.optionD'),
        ]}
        correctIndex={1}
        chosenIndex={1}
        explanation={t('m.practice.explanation')}
      />
    </Panel>
  )
}

function MasterVisual() {
  const { t } = useTranslation()
  return (
    <Panel>
      <div className="rounded-2xl bg-ink-50 p-3">
        <MasteryRing
          value={92}
          size={80}
          tone="gold"
          label={t('m.flow.master.ringLabel')}
          sublabel={t('m.flow.master.ringSub')}
        />
      </div>
      <SubjectRow name={t('m.subject.mathematics')} mastery={92} />
      <SubjectRow name={t('m.subject.naturalSciences')} mastery={58} attention />
      <p className="px-1 pt-0.5 text-xs leading-relaxed text-ink-400">{t('m.flow.master.note')}</p>
    </Panel>
  )
}
