import { useState, type FormEvent } from 'react'
import {
  MAX_TRIP_NIGHTS,
  nightsBetween,
  preferencesSchema,
  type PreferencesInput,
} from '../../../shared/schemas'
import type { Preferences } from '../../../shared/types'
import { ErrorNotice } from './ui'

const INTERESTS = [
  ['beaches', 'Beaches'],
  ['nature', 'Nature'],
  ['wildlife', 'Wildlife'],
  ['food', 'Food'],
  ['culture', 'Culture'],
  ['history', 'History'],
  ['shopping', 'Shopping'],
  ['adventure', 'Adventure'],
  ['nightlife', 'Nightlife'],
  ['wellness', 'Wellness'],
  ['viewpoints', 'Viewpoints'],
  ['family', 'Family activities'],
] as const

const TRIP_TYPES = [
  ['general', 'General holiday'],
  ['honeymoon', 'Honeymoon / couple'],
  ['family', 'Family'],
  ['solo', 'Solo'],
  ['group', 'Group of friends'],
  ['adventure', 'Adventure'],
  ['relaxation', 'Relaxation'],
] as const

const TRANSPORT = [
  ['undecided', 'Not sure yet'],
  ['rental_car', 'Rental car'],
  ['taxi', 'Taxi / ride-hailing'],
  ['public', 'Public transport'],
  ['walking', 'Walking'],
  ['guided', 'Guided transport'],
] as const

const AGES = ['0-2', '3-5', '6-12', '13-17'] as const

const STEPS = ['Dates & group', 'Style & budget', 'Interests', 'Anything else'] as const
const STEP_FIELDS: string[][] = [
  ['checkIn', 'checkOut', 'adults', 'childAgeRanges'],
  ['tripType', 'budget', 'transport', 'pace'],
  ['interests', 'settingPreference'],
  ['accessibilityNeeds', 'dietaryPreferences', 'language'],
]

const isoToday = (offset = 0) =>
  new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)

function initial(
  p: Preferences | null,
): PreferencesInput & { childAgeRanges: string[]; interests: string[] } {
  return p
    ? {
        ...p,
        accessibilityNeeds: p.accessibilityNeeds ?? '',
        dietaryPreferences: p.dietaryPreferences ?? '',
      }
    : {
        checkIn: isoToday(30),
        checkOut: isoToday(34),
        adults: 2,
        childAgeRanges: [],
        tripType: 'general',
        budget: null,
        transport: 'undecided',
        interests: [],
        pace: 'balanced',
        accessibilityNeeds: '',
        dietaryPreferences: '',
        settingPreference: 'no_preference',
        language: 'en',
      }
}

export function Questionnaire({
  value,
  onSave,
  busy,
}: {
  value: Preferences | null
  onSave: (p: PreferencesInput) => Promise<void>
  busy?: boolean
}) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(() => initial(value))
  const [budgetText, setBudgetText] = useState(
    value?.budget ? String(value.budget.amount) : '',
  )
  const [currency, setCurrency] = useState(value?.budget?.currency ?? 'USD')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<unknown>(null)
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }))
  const toggle = (k: 'interests' | 'childAgeRanges', v: string) =>
    setForm((f) => ({
      ...f,
      [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v],
    }))

  const candidate = (): PreferencesInput => {
    const amount = Number(budgetText)
    return {
      ...form,
      budget:
        budgetText.trim() && Number.isFinite(amount) && amount > 0
          ? { amount, currency }
          : null,
    } as PreferencesInput
  }

  /** Field → first error message, across the whole form. */
  const validate = (): Record<string, string> => {
    const r = preferencesSchema.safeParse(candidate())
    const e: Record<string, string> = {}
    if (!r.success) for (const i of r.error.issues) e[String(i.path[0])] ??= i.message
    if (budgetText.trim() && !(Number(budgetText) > 0))
      e.budget = 'Enter a positive number, or leave it blank.'
    if (budgetText.trim() && !/^[A-Z]{3}$/.test(currency))
      e.budget = 'Use a 3-letter currency code, e.g. USD.'
    return e
  }

  const stepOf = (field: string) =>
    STEP_FIELDS.findIndex((fields) => fields.includes(field))
  const next = (ev: FormEvent) => {
    ev.preventDefault()
    const e = validate()
    const fieldsHere = Object.keys(e).filter((f) => stepOf(f) === step)
    if (step < STEPS.length - 1) {
      // Only block on this step's own fields when moving forward.
      setErrors(Object.fromEntries(fieldsHere.map((f) => [f, e[f]!])))
      if (fieldsHere.length === 0) setStep(step + 1)
      return
    }
    setErrors(e)
    const first = Object.keys(e)[0]
    if (first) {
      setStep(Math.max(0, stepOf(first)))
      return
    }
    setSubmitError(null)
    onSave(candidate()).catch(setSubmitError)
  }

  const nights = nightsBetween(form.checkIn, form.checkOut)
  const err = (k: string) =>
    errors[k] ? (
      <p id={`${k}-error`} className="mt-1 text-sm text-coral">
        {errors[k]}
      </p>
    ) : null

  return (
    <form onSubmit={next} noValidate className="space-y-6">
      <div>
        <p className="text-sm text-muted" aria-live="polite">
          Step {step + 1} of {STEPS.length}:{' '}
          <strong className="text-ink">{STEPS[step]}</strong>
        </p>
        <div className="mt-2 flex gap-1.5" aria-hidden>
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-sea' : 'bg-line'}`}
            />
          ))}
        </div>
      </div>

      {step === 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="checkIn">
              Check-in
            </label>
            <input
              id="checkIn"
              type="date"
              className="field"
              value={form.checkIn}
              onChange={(e) => set('checkIn', e.target.value)}
              aria-describedby={errors.checkIn ? 'checkIn-error' : undefined}
            />
            {err('checkIn')}
          </div>
          <div>
            <label className="field-label" htmlFor="checkOut">
              Check-out
            </label>
            <input
              id="checkOut"
              type="date"
              className="field"
              value={form.checkOut}
              onChange={(e) => set('checkOut', e.target.value)}
              aria-describedby={errors.checkOut ? 'checkOut-error' : 'nights-hint'}
            />
            {err('checkOut') ?? (
              <p id="nights-hint" className="mt-1 text-sm text-muted">
                {nights > 0 ? `${nights} night${nights === 1 ? '' : 's'}` : ''}{' '}
                {nights > MAX_TRIP_NIGHTS ? `(max ${MAX_TRIP_NIGHTS})` : ''}
              </p>
            )}
          </div>
          <div>
            <label className="field-label" htmlFor="adults">
              Adults
            </label>
            <input
              id="adults"
              type="number"
              min={1}
              max={20}
              inputMode="numeric"
              className="field"
              value={form.adults}
              onChange={(e) => set('adults', Number(e.target.value))}
            />
            {err('adults')}
          </div>
          <fieldset>
            <legend className="field-label">Children (optional)</legend>
            <p className="mb-2 text-sm text-muted">
              Select every age range that applies. We never ask for names or birth dates.
            </p>
            <div className="flex flex-wrap gap-2">
              {AGES.map((a) => (
                <button
                  key={a}
                  type="button"
                  className="chip"
                  aria-pressed={form.childAgeRanges.includes(a)}
                  onClick={() => toggle('childAgeRanges', a)}
                >
                  {a} yrs
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="tripType">
              Kind of trip
            </label>
            <select
              id="tripType"
              className="field"
              value={form.tripType}
              onChange={(e) => set('tripType', e.target.value as never)}
            >
              {TRIP_TYPES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="transport">
              Getting around
            </label>
            <select
              id="transport"
              className="field"
              value={form.transport}
              onChange={(e) => set('transport', e.target.value as never)}
            >
              {TRANSPORT.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="budget">
              Activity budget for the whole trip (optional)
            </label>
            <div className="flex gap-2">
              <input
                id="budget"
                inputMode="decimal"
                className="field"
                value={budgetText}
                onChange={(e) => setBudgetText(e.target.value)}
                placeholder="e.g. 400"
                aria-describedby={errors.budget ? 'budget-error' : undefined}
              />
              <label className="sr-only" htmlFor="currency">
                Currency
              </label>
              <input
                id="currency"
                className="field !w-24 uppercase"
                maxLength={3}
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              />
            </div>
            {err('budget')}
          </div>
          <fieldset>
            <legend className="field-label">Pace</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Pace">
              {(
                [
                  ['relaxed', 'Relaxed · 1 a day'],
                  ['balanced', 'Balanced · 2 a day'],
                  ['packed', 'Packed · 3 a day'],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  className="chip"
                  aria-checked={form.pace === v}
                  onClick={() => set('pace', v)}
                >
                  {l}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <fieldset>
            <legend className="field-label">What do you enjoy? (pick any)</legend>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  className="chip"
                  aria-pressed={form.interests.includes(v)}
                  onClick={() => toggle('interests', v)}
                >
                  {l}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="field-label">Indoors or outdoors?</legend>
            <div
              className="flex flex-wrap gap-2"
              role="radiogroup"
              aria-label="Indoors or outdoors"
            >
              {(
                [
                  ['no_preference', 'No preference'],
                  ['outdoor', 'Mostly outdoors'],
                  ['indoor', 'Mostly indoors'],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  className="chip"
                  aria-checked={form.settingPreference === v}
                  onClick={() => set('settingPreference', v)}
                >
                  {l}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="access">
              Accessibility or mobility needs (optional)
            </label>
            <textarea
              id="access"
              className="field min-h-24"
              maxLength={300}
              value={form.accessibilityNeeds ?? ''}
              onChange={(e) => set('accessibilityNeeds', e.target.value)}
            />
            <p className="mt-1 text-xs text-muted">
              Shown with your plan as a reminder. StayScout cannot yet verify venue
              accessibility.
            </p>
          </div>
          <div>
            <label className="field-label" htmlFor="diet">
              Dietary preferences (optional)
            </label>
            <textarea
              id="diet"
              className="field min-h-24"
              maxLength={300}
              value={form.dietaryPreferences ?? ''}
              onChange={(e) => set('dietaryPreferences', e.target.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="language">
              Language
            </label>
            <select
              id="language"
              className="field"
              value={form.language}
              onChange={(e) => set('language', e.target.value)}
            >
              <option value="en">English</option>
            </select>
            <p className="mt-1 text-xs text-muted">More languages are planned.</p>
          </div>
        </div>
      )}

      {submitError ? <ErrorNotice error={submitError} /> : null}
      <div className="flex flex-wrap items-center gap-3">
        {step > 0 && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setStep(step - 1)}
          >
            Back
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {step < STEPS.length - 1 ? 'Continue' : 'Save and find places'}
        </button>
        {step > 0 && step < STEPS.length - 1 && (
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => setStep(STEPS.length - 1)}
          >
            Skip optional questions
          </button>
        )}
      </div>
    </form>
  )
}
