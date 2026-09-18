import type { ReactNode } from 'react'
import clsx from 'clsx'
import { Camera, Check, Flame, Sparkles, Target, X } from 'lucide-react'

/**
 * The product mockup vocabulary for the marketing site.
 *
 * Every piece here mirrors something that actually exists in StudyLegends:
 * mastery percentages come from the mastery engine, the practice card is the
 * same shape as `QuestionRunner` (prompt, options, marked answer, explanation),
 * the streak and daily goal are the gamification features, and the scan card
 * is Scan My Work. Nothing invents a feature the product does not have.
 *
 * These render the light app UI inside the dark page, which is both accurate
 * and what makes the screenshots read as a real product rather than decoration.
 */

/** Device shell. Dark bezel, rounded screen, subtle outer glow. */
export function PhoneFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('relative', className)}>
      <div
        className={clsx(
          'relative rounded-[2.75rem] border border-ink-700/80 bg-ink-950 p-2.5',
          'shadow-[0_40px_90px_-30px_rgba(6,11,22,0.9)] ring-1 ring-white/5',
        )}
      >
        {/* Speaker slot, for the read of a real handset. */}
        <div className="absolute left-1/2 top-4 z-10 h-1.5 w-16 -translate-x-1/2 rounded-full bg-ink-800" />
        <div className="overflow-hidden rounded-[2.25rem] bg-ink-50">{children}</div>
      </div>
    </div>
  )
}

/** Mastery percentage, as the app shows it. */
export function MasteryRing({
  value,
  size = 88,
  label,
  sublabel,
  tone = 'volt',
}: {
  value: number
  size?: number
  label?: string
  sublabel?: string
  tone?: 'volt' | 'gold'
}) {
  const stroke = Math.max(6, Math.round(size * 0.09))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(100, Math.max(0, value))
  const target = circumference * (1 - clamped / 100)

  return (
    <div className="flex items-center gap-3">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            className="stroke-ink-200"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={target}
            className={clsx(
              'animate-ring-fill',
              tone === 'volt' ? 'stroke-volt-500' : 'stroke-gold-400',
            )}
            style={
              {
                '--ring-circumference': `${circumference}`,
                '--ring-target': `${target}`,
              } as React.CSSProperties
            }
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-display text-lg font-extrabold text-ink-900">
          {clamped}%
        </span>
      </div>
      {(label || sublabel) && (
        <div className="min-w-0">
          {label && <p className="truncate font-bold text-ink-900">{label}</p>}
          {sublabel && <p className="truncate text-xs text-ink-400">{sublabel}</p>}
        </div>
      )}
    </div>
  )
}

/** A subject with its mastery bar -- the learner dashboard's main row. */
export function SubjectRow({
  name,
  mastery,
  attention,
}: {
  name: string
  mastery: number
  attention?: boolean
}) {
  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate text-sm font-bold text-ink-900">{name}</p>
        <p
          className={clsx(
            'shrink-0 font-display text-sm font-extrabold',
            attention ? 'text-gold-600' : 'text-volt-600',
          )}
        >
          {mastery}%
        </p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-100">
        <div
          className={clsx('animate-bar-fill h-full rounded-full', attention ? 'bg-gold-400' : 'bg-volt-500')}
          style={{ width: `${Math.min(100, Math.max(0, mastery))}%` }}
        />
      </div>
    </div>
  )
}

export function StatTile({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon?: typeof Target
}) {
  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm">
      <div className="flex items-center gap-1.5 text-ink-400">
        {Icon && <Icon size={13} />}
        <p className="truncate text-[11px] font-semibold">{label}</p>
      </div>
      <p className="mt-0.5 font-display text-xl font-extrabold text-ink-900">{value}</p>
    </div>
  )
}

export function StreakPill({ days }: { days: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gold-100 px-2.5 py-1 text-xs font-extrabold text-gold-600">
      <Flame size={13} />
      {days}
    </span>
  )
}

export function DailyGoalPill({ done, target }: { done: number; target: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-volt-50 px-2.5 py-1 text-xs font-extrabold text-volt-700">
      <Target size={13} />
      {done}/{target}
    </span>
  )
}

/** One turn of the tutor conversation. */
export function TutorTurn({
  from,
  children,
}: {
  from: 'learner' | 'tutor'
  children: ReactNode
}) {
  if (from === 'learner') {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-ink-800 px-3.5 py-2.5 text-sm font-semibold text-white">
          {children}
        </p>
      </div>
    )
  }
  return (
    <div className="flex gap-2">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-volt-500 text-white">
        <Sparkles size={14} />
      </span>
      <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-white px-3.5 py-2.5 text-sm text-ink-700 shadow-sm">
        {children}
      </div>
    </div>
  )
}

/**
 * A practice question exactly as the learner meets it: prompt, options, the
 * chosen answer marked, and the explanation shown either way. The explanation
 * is the point -- it is what separates this from a worksheet.
 */
export function PracticeCard({
  prompt,
  options,
  correctIndex,
  chosenIndex,
  explanation,
}: {
  prompt: string
  options: string[]
  correctIndex: number
  chosenIndex?: number
  explanation?: string
}) {
  return (
    <div className="rounded-2xl bg-white p-3.5 shadow-sm">
      <p className="text-sm font-bold text-ink-900">{prompt}</p>
      <div className="mt-2.5 space-y-1.5">
        {options.map((option, index) => {
          const isCorrect = index === correctIndex
          const isChosen = index === chosenIndex
          const marked = chosenIndex !== undefined
          return (
            <div
              key={option}
              className={clsx(
                'flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-semibold',
                marked && isCorrect && 'border-success-500 bg-success-50 text-success-600',
                marked && isChosen && !isCorrect && 'border-danger-500 bg-danger-50 text-danger-600',
                (!marked || (!isCorrect && !isChosen)) && 'border-ink-100 text-ink-500',
              )}
            >
              {marked && isCorrect && <Check size={14} className="shrink-0" />}
              {marked && isChosen && !isCorrect && <X size={14} className="shrink-0" />}
              <span>{option}</span>
            </div>
          )
        })}
      </div>
      {explanation && (
        <p className="mt-2.5 rounded-xl bg-ink-50 p-2.5 text-xs leading-relaxed text-ink-600">
          {explanation}
        </p>
      )}
    </div>
  )
}

/** Scan My Work: the captured page and the topic the app detected in it. */
export function ScanCard({ caption, detected }: { caption: string; detected: string }) {
  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm">
      <div className="relative overflow-hidden rounded-xl border border-ink-100 bg-ink-50 p-3">
        {/* A worksheet, drawn rather than photographed -- no stock imagery. */}
        <div className="space-y-1.5" aria-hidden>
          <div className="h-1.5 w-1/3 rounded-full bg-ink-300" />
          <div className="h-1.5 w-full rounded-full bg-ink-200" />
          <div className="h-1.5 w-5/6 rounded-full bg-ink-200" />
          <div className="h-1.5 w-2/3 rounded-full bg-ink-200" />
          <div className="mt-2 h-1.5 w-1/2 rounded-full bg-ink-300" />
          <div className="h-1.5 w-3/4 rounded-full bg-ink-200" />
        </div>
        <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-xl bg-ink-900 text-white">
          <Camera size={14} />
        </span>
      </div>
      <p className="mt-2.5 text-[11px] font-semibold text-ink-400">{caption}</p>
      <p className="mt-0.5 text-sm font-bold text-ink-900">{detected}</p>
    </div>
  )
}
