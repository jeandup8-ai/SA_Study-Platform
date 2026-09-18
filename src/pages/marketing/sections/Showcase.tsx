import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import {
  BookOpen,
  Award,
  GraduationCap,
  LineChart,
  PenLine,
  ScanLine,
  Sparkles,
} from 'lucide-react'
import {
  DailyGoalPill,
  MasteryRing,
  PhoneFrame,
  PracticeCard,
  ScanCard,
  Section,
  SectionHeading,
  StatTile,
  StreakPill,
  SubjectRow,
  TutorTurn,
} from '@/components/marketing'

/**
 * The interactive product tour.
 *
 * Seven tabs, one device. Every panel is a surface that exists in the app --
 * the AI tutor, lessons, practice, Scan My Work, exam preparation, progress
 * and rewards. A visitor can drive it themselves, which does more for
 * confidence than any amount of copy about what the product contains.
 */
const TABS = [
  { key: 'tutor', icon: Sparkles },
  { key: 'lessons', icon: BookOpen },
  { key: 'practice', icon: PenLine },
  { key: 'scan', icon: ScanLine },
  { key: 'exam', icon: GraduationCap },
  { key: 'progress', icon: LineChart },
  { key: 'rewards', icon: Award },
] as const

type TabKey = (typeof TABS)[number]['key']

export function Showcase() {
  const { t } = useTranslation()
  const [active, setActive] = useState<TabKey>('tutor')

  return (
    <Section tone="darker">
      <SectionHeading
        eyebrow={t('m.showcase.eyebrow')}
        title={
          <>
            {t('m.showcase.titleLine1')}
            <br />
            <span className="text-volt-300">{t('m.showcase.titleLine2')}</span>
          </>
        }
        lead={t('m.showcase.lead')}
      />

      <div className="mt-14 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-16">
        <div>
          {/* Horizontally scrollable on phones rather than wrapping into a
              four-row block that pushes the device off screen. */}
          <div
            role="tablist"
            aria-label={t('m.showcase.tablistLabel')}
            className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0"
          >
            {TABS.map(({ key, icon: Icon }) => {
              const selected = active === key
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActive(key)}
                  className={clsx(
                    'flex min-h-11 shrink-0 items-center gap-2 rounded-2xl px-4 text-sm font-bold transition-all duration-200',
                    'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-volt-300/50',
                    selected
                      ? 'bg-volt-400 text-ink-950'
                      : 'border border-white/10 bg-white/[0.04] text-ink-200 hover:border-white/25 hover:text-white',
                  )}
                >
                  <Icon size={15} />
                  {t(`m.showcase.tab.${key}.label`)}
                </button>
              )
            })}
          </div>

          <div className="mt-8 rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-7 sm:p-9">
            <h3 className="font-display text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              {t(`m.showcase.tab.${active}.title`)}
            </h3>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-ink-200 sm:text-lg">
              {t(`m.showcase.tab.${active}.body`)}
            </p>
            <p className="mt-5 inline-flex rounded-xl bg-volt-400/10 px-3 py-1.5 text-xs font-bold text-volt-200">
              {t(`m.showcase.tab.${active}.chip`)}
            </p>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[20rem]">
          <PhoneFrame>
            {/* `key` remounts the panel so its reveal and bar animations
                replay each time the visitor switches tab. */}
            <div key={active} className="min-h-[30rem] space-y-2.5 p-4 pt-7">
              <Panel tab={active} />
            </div>
          </PhoneFrame>
        </div>
      </div>
    </Section>
  )
}

function ScreenTitle({ children }: { children: ReactNode }) {
  return <p className="px-0.5 font-display text-base font-extrabold text-ink-900">{children}</p>
}

function Panel({ tab }: { tab: TabKey }) {
  const { t } = useTranslation()

  if (tab === 'tutor') {
    return (
      <>
        <ScreenTitle>{t('m.showcase.tab.tutor.label')}</ScreenTitle>
        <TutorTurn from="learner">{t('m.tutor.learnerAsk')}</TutorTurn>
        <TutorTurn from="tutor">{t('m.tutor.reply1')}</TutorTurn>
        <TutorTurn from="tutor">{t('m.tutor.reply2')}</TutorTurn>
        <TutorTurn from="tutor">{t('m.tutor.reply3')}</TutorTurn>
      </>
    )
  }

  if (tab === 'lessons') {
    return (
      <>
        <ScreenTitle>{t('m.device.topic')}</ScreenTitle>
        <div className="rounded-2xl bg-white p-3.5 shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-volt-600">
            {t('m.showcase.lesson.explainLabel')}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-700">
            {t('m.showcase.lesson.explainBody')}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-3.5 shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-lilac-600">
            {t('m.showcase.lesson.exampleLabel')}
          </p>
          {/* A fraction drawn as parts of a whole, which is how the lesson
              actually presents it. */}
          <div className="mt-2.5 flex gap-1" aria-hidden>
            {[0, 1, 2, 3].map((index) => (
              <span
                key={index}
                className={clsx(
                  'h-8 flex-1 rounded-lg border-2',
                  index < 3 ? 'border-volt-500 bg-volt-200' : 'border-ink-200 bg-ink-50',
                )}
              />
            ))}
          </div>
          <p className="mt-2 text-xs font-semibold text-ink-500">
            {t('m.showcase.lesson.exampleCaption')}
          </p>
        </div>
        <div className="rounded-2xl bg-ink-900 p-3.5">
          <p className="text-xs font-bold text-white">{t('m.showcase.lesson.nextUp')}</p>
        </div>
      </>
    )
  }

  if (tab === 'practice') {
    return (
      <>
        <ScreenTitle>{t('m.showcase.tab.practice.label')}</ScreenTitle>
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
        <PracticeCard
          prompt={t('m.practice.prompt2')}
          options={[t('m.practice.p2a'), t('m.practice.p2b'), t('m.practice.p2c'), t('m.practice.p2d')]}
          correctIndex={2}
        />
      </>
    )
  }

  if (tab === 'scan') {
    return (
      <>
        <ScreenTitle>{t('m.showcase.tab.scan.label')}</ScreenTitle>
        <ScanCard caption={t('m.flow.scan.caption')} detected={t('m.flow.scan.detected')} />
        <TutorTurn from="tutor">{t('m.showcase.scan.reply')}</TutorTurn>
      </>
    )
  }

  if (tab === 'exam') {
    return (
      <>
        <ScreenTitle>{t('m.showcase.tab.exam.label')}</ScreenTitle>
        <div className="rounded-2xl bg-white p-3 shadow-sm">
          <MasteryRing
            value={74}
            size={80}
            label={t('m.showcase.exam.ringLabel')}
            sublabel={t('m.showcase.exam.ringSub')}
          />
        </div>
        <div className="rounded-2xl bg-white p-3.5 shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-gold-600">
            {t('m.showcase.exam.reviseLabel')}
          </p>
          <ul className="mt-2 space-y-1.5">
            {['a', 'b', 'c'].map((key) => (
              <li key={key} className="flex items-center gap-2 text-xs font-semibold text-ink-600">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400" />
                {t(`m.showcase.exam.topic.${key}`)}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl bg-ink-900 p-3.5">
          <p className="text-xs font-bold text-white">{t('m.showcase.exam.mockTest')}</p>
        </div>
      </>
    )
  }

  if (tab === 'progress') {
    return (
      <>
        <ScreenTitle>{t('m.showcase.tab.progress.label')}</ScreenTitle>
        <div className="grid grid-cols-2 gap-2">
          <StatTile label={t('m.progress.stat.lessons')} value="34" icon={BookOpen} />
          <StatTile label={t('m.progress.stat.questions')} value="412" icon={PenLine} />
        </div>
        <SubjectRow name={t('m.subject.mathematics')} mastery={78} />
        <SubjectRow name={t('m.subject.naturalSciences')} mastery={64} attention />
        <SubjectRow name={t('m.subject.englishHl')} mastery={82} />
        <SubjectRow name={t('m.subject.socialSciences')} mastery={71} />
      </>
    )
  }

  return (
    <>
      <ScreenTitle>{t('m.showcase.tab.rewards.label')}</ScreenTitle>
      <div className="flex gap-2">
        <StreakPill days={6} />
        <DailyGoalPill done={5} target={5} />
      </div>
      <div className="rounded-2xl bg-gradient-to-br from-gold-300 to-gold-500 p-4">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink-900/70">
          {t('m.showcase.rewards.unlocked')}
        </p>
        <p className="mt-1 font-display text-lg font-extrabold text-ink-950">
          {t('m.showcase.rewards.badge')}
        </p>
        <p className="mt-1 text-xs font-semibold text-ink-900/75">
          {t('m.showcase.rewards.badgeWhy')}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <StatTile label={t('m.showcase.rewards.points')} value="1 240" icon={Award} />
        <StatTile label={t('m.showcase.rewards.badges')} value="7" icon={Award} />
      </div>
      <p className="px-1 text-[11px] leading-relaxed text-ink-400">
        {t('m.showcase.rewards.note')}
      </p>
    </>
  )
}
