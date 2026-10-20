// Itinerary engine.
//
// Every itinerary — from the deterministic scheduler, from the AI, or from a
// traveller's edit — is a *plan* (ids, slots, times). hydratePlan() turns a
// plan into an Itinerary using only the trip's own validated place records,
// and validateItinerary() checks it against those records, the dates and the
// 50 km rule. Nothing reaches storage or a PDF without passing validation.

import { distanceMeters, isWithinRadius } from '../../shared/geo.js'
import { nightsBetween } from '../../shared/schemas.js'
import type {
  Accommodation,
  Itinerary,
  ItineraryDay,
  ItineraryIssue,
  ItineraryItem,
  OpeningPeriod,
  Pace,
  Preferences,
  Slot,
  TransportMode,
  TripPlace,
} from '../../shared/types.js'

export interface PlanItem {
  id?: string
  slot: Slot
  kind: 'activity' | 'meal' | 'free'
  placeId: string | null
  startTime: string
  durationMinutes: number
}

export interface PlanDay {
  date: string
  items: PlanItem[]
}

export interface EngineContext {
  accommodation: Accommodation
  preferences: Preferences
  /** All of the trip's places, already radius-checked from this accommodation. */
  places: TripPlace[]
  now: Date
  newId: () => string
}

// ---------------------------------------------------------------- constants

/** Major (non-meal) activities per day, by pace. */
export const PACE_LIMITS: Record<Pace, number> = { relaxed: 1, balanced: 2, packed: 3 }
/** Hard ceiling regardless of pace or edits. */
export const ABSOLUTE_MAX_ACTIVITIES_PER_DAY = 4
const ARRIVAL_START = '15:00'
const DEPARTURE_LATEST_END = '11:30'
const DAY_END = '23:00'
const WALKING_LIMIT_M = 5_000
const MEAL_DETOUR_LIMIT_M = 10_000

/** Average door-to-door speeds for a rough estimate. Never presented as live traffic. */
const SPEED_KMH: Record<TransportMode, number> = {
  walking: 4.5,
  public: 18,
  rental_car: 40,
  taxi: 35,
  guided: 35,
  undecided: 35,
}
const OVERHEAD_MIN: Record<TransportMode, number> = {
  walking: 0,
  public: 15,
  rental_car: 10,
  taxi: 10,
  guided: 10,
  undecided: 10,
}
/** Roads are longer than straight lines; 1.3 is a common rule of thumb. */
const DETOUR_FACTOR = 1.3

// ------------------------------------------------------------------ helpers

export const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}
export const fromMinutes = (min: number): string => {
  const m = Math.max(0, Math.min(min, 24 * 60 - 1))
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
const roundUp5 = (n: number) => Math.ceil(n / 5) * 5

export function tripDates(checkIn: string, checkOut: string): string[] {
  const n = nightsBetween(checkIn, checkOut)
  const start = Date.parse(`${checkIn}T00:00:00Z`)
  return Array.from({ length: n + 1 }, (_, i) => new Date(start + i * 86_400_000).toISOString().slice(0, 10))
}

const dayOfWeek = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay()

export function travelMinutes(meters: number, mode: TransportMode): number {
  if (meters < 150) return 0
  const km = (meters / 1000) * DETOUR_FACTOR
  return roundUp5(OVERHEAD_MIN[mode] + (km / SPEED_KMH[mode]) * 60)
}

/** Hours we are willing to plan around. Unverified hours are never treated as fact. */
const trustedHours = (p: TripPlace): OpeningPeriod[] | null =>
  p.openingHours && (p.openingHours.status === 'VERIFIED_SOURCE' || p.openingHours.status === 'PROVIDER_LISTED')
    ? p.openingHours.value
    : null

export function openDuring(hours: OpeningPeriod[], date: string, startMin: number, endMin: number): boolean {
  const dow = dayOfWeek(date)
  return hours.some((h) => h.day === dow && toMinutes(h.open) <= startMin && endMin <= toMinutes(h.close))
}

const isMajor = (item: { kind: string }) => item.kind === 'activity'
const travellers = (p: Preferences) => p.adults + p.childAgeRanges.length

function minimumAge(p: TripPlace): number | null {
  for (const s of p.suitability) {
    const m = /minimum age (\d{1,2})/i.exec(s.note)
    if (m) return Number(m[1])
    if (/18\+|adults only/i.test(s.note)) return 18
  }
  return null
}

const youngestChild = (prefs: Preferences): number | null => {
  const lows = prefs.childAgeRanges.map((r) => Number(r.split('-')[0]))
  return lows.length ? Math.min(...lows) : null
}

// ---------------------------------------------------------------- hydration

/** Builds titles, notes, travel estimates and costs from the trip's own records. */
export function hydratePlan(
  plan: PlanDay[],
  ctx: EngineContext,
  meta: { generatedBy: Itinerary['generatedBy']; version: number; warnings?: string[] },
): Itinerary {
  const byId = new Map(ctx.places.map((p) => [p.id, p]))
  const prefs = ctx.preferences
  const dates = tripDates(prefs.checkIn, prefs.checkOut)
  const youngest = youngestChild(prefs)

  const days: ItineraryDay[] = plan.map((day) => {
    let prev = ctx.accommodation.location
    let costMin = 0
    let costMax = 0
    let priced = 0
    let unpriced = 0
    const sorted = [...day.items].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))
    const items: ItineraryItem[] = sorted.map((pi) => {
      const place = pi.placeId ? byId.get(pi.placeId) : undefined
      const notes: string[] = []
      let travel: number | null = null
      if (place) {
        const legMeters = distanceMeters(prev, place.location)
        travel = travelMinutes(legMeters, prefs.transport)
        prev = place.location
        if (place.isSample) notes.push('Sample place (fictional demonstration data).')
        if (!trustedHours(place)) notes.push('Opening hours not confirmed — check before you go.')
        for (const w of place.warnings) notes.push(w)
        for (const s of place.suitability) {
          if (/book/i.test(s.note)) notes.push(`Booking: ${s.note}`)
        }
        const minAge = minimumAge(place)
        if (minAge !== null && youngest !== null && youngest < minAge) {
          notes.push(`Age check: listed minimum age is ${minAge}; your group may include children under that age.`)
        }
        if (prefs.transport === 'walking' && place.distanceMeters > WALKING_LIMIT_M) {
          notes.push('Too far to walk comfortably from your stay — arrange a lift or tour.')
        }
        if (prefs.transport === 'public') {
          notes.push('Public transport routes have not been checked by StayScout.')
        }
        const amount = place.price?.value.amount
        if (amount && (!prefs.budget || amount.currency === prefs.budget.currency)) {
          costMin += amount.min * travellers(prefs)
          costMax += amount.max * travellers(prefs)
          priced++
        } else if (place.price?.value.level === 'free') {
          priced++
        } else {
          unpriced++
        }
      }
      return {
        id: pi.id ?? ctx.newId(),
        slot: pi.slot,
        kind: pi.kind,
        placeId: place ? place.id : pi.placeId,
        title: place ? place.name : pi.kind === 'meal' ? mealTitle(pi.slot) : 'Free time',
        startTime: pi.startTime,
        durationMinutes: pi.durationMinutes,
        travelMinutesEstimate: travel,
        notes,
      }
    })
    const currency = prefs.budget?.currency ?? firstCurrency(items, byId) ?? 'USD'
    const index = dates.indexOf(day.date)
    return {
      date: day.date,
      label: dayLabel(index, dates.length, day.date),
      items,
      notes: dayNotes(index, dates.length),
      estimatedCost: priced > 0 ? { min: costMin, max: costMax, currency } : null,
      unpricedItems: unpriced,
    }
  })

  const warnings = [...(meta.warnings ?? [])]
  if (prefs.budget) {
    const total = days.reduce((s, d) => s + (d.estimatedCost?.min ?? 0), 0)
    if (total > prefs.budget.amount) {
      warnings.push(
        `Known activity prices already come to at least ${prefs.budget.currency} ${total.toFixed(0)}, above your budget of ${prefs.budget.currency} ${prefs.budget.amount}.`,
      )
    }
  }
  return {
    version: meta.version,
    generatedBy: meta.generatedBy,
    generatedAt: ctx.now.toISOString(),
    accommodationKey: accommodationKey(ctx.accommodation),
    days,
    warnings,
  }
}

const firstCurrency = (items: ItineraryItem[], byId: Map<string, TripPlace>) => {
  for (const i of items) {
    const c = i.placeId ? byId.get(i.placeId)?.price?.value.amount?.currency : undefined
    if (c) return c
  }
  return null
}

const mealTitle = (slot: Slot) => (slot === 'evening' ? 'Dinner — your choice' : 'Lunch break')

function dayLabel(index: number, count: number, date: string): string {
  const weekday = new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })
  if (index === 0) return `Day 1 · ${weekday} · Arrival`
  if (index === count - 1) return `Day ${index + 1} · ${weekday} · Departure`
  return `Day ${index + 1} · ${weekday}`
}

function dayNotes(index: number, count: number): string[] {
  if (index === 0) return ['Arrival day: plans start mid-afternoon to allow for travel and check-in.']
  if (index === count - 1) return ['Departure day: a light morning, finishing in time for check-out.']
  return []
}

export const accommodationKey = (a: { provider: string; providerPlaceId: string }) =>
  `${a.provider}:${a.providerPlaceId}`

// --------------------------------------------------------------- validation

export function validateItinerary(itin: Itinerary, ctx: EngineContext): ItineraryIssue[] {
  const issues: ItineraryIssue[] = []
  const err = (i: Omit<ItineraryIssue, 'severity'>) => issues.push({ severity: 'error', ...i })
  const warn = (i: Omit<ItineraryIssue, 'severity'>) => issues.push({ severity: 'warning', ...i })
  const byId = new Map(ctx.places.map((p) => [p.id, p]))
  const prefs = ctx.preferences
  const dates = tripDates(prefs.checkIn, prefs.checkOut)
  const origin = ctx.accommodation.location

  if (!ctx.accommodation.confirmed) {
    err({ code: 'accommodation_unconfirmed', message: 'Confirm your accommodation before saving a guide.' })
  }
  if (itin.accommodationKey !== accommodationKey(ctx.accommodation)) {
    err({ code: 'accommodation_mismatch', message: 'This plan was built around a different accommodation.' })
  }

  const seenDates = new Set<string>()
  const seenPlaces = new Map<string, number>()
  itin.days.forEach((day, dayIndex) => {
    if (!dates.includes(day.date)) {
      err({ code: 'date_out_of_range', dayIndex, message: `${day.date} is outside your stay.` })
    }
    if (seenDates.has(day.date)) err({ code: 'duplicate_date', dayIndex, message: `${day.date} appears twice.` })
    seenDates.add(day.date)

    const majors = day.items.filter(isMajor).length
    if (majors > ABSOLUTE_MAX_ACTIVITIES_PER_DAY) {
      err({ code: 'too_many_activities', dayIndex, message: `More than ${ABSOLUTE_MAX_ACTIVITIES_PER_DAY} activities in one day.` })
    } else if (majors > PACE_LIMITS[prefs.pace]) {
      warn({ code: 'over_pace', dayIndex, message: `More activities than your ${prefs.pace} pace suggests.` })
    }

    const isArrival = day.date === dates[0]
    const isDeparture = day.date === dates[dates.length - 1]
    let cursor = 0
    for (const item of [...day.items].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))) {
      const start = toMinutes(item.startTime)
      const end = start + item.durationMinutes
      const travel = item.travelMinutesEstimate ?? 0
      if (start - travel < cursor) {
        err({ code: 'overlap', dayIndex, itemId: item.id, message: `"${item.title}" starts before the previous item and travel can finish.` })
      }
      if (end > toMinutes(DAY_END)) {
        err({ code: 'too_late', dayIndex, itemId: item.id, message: `"${item.title}" runs past ${DAY_END}.` })
      }
      if (isArrival && start < toMinutes(ARRIVAL_START) && isMajor(item)) {
        warn({ code: 'arrival_early', dayIndex, itemId: item.id, message: `"${item.title}" is before a typical arrival time.` })
      }
      if (isDeparture && end > toMinutes(DEPARTURE_LATEST_END) && isMajor(item)) {
        warn({ code: 'departure_late', dayIndex, itemId: item.id, message: `"${item.title}" may clash with check-out.` })
      }
      cursor = end

      if (item.kind === 'activity' && !item.placeId) {
        err({ code: 'activity_without_place', dayIndex, itemId: item.id, message: 'Every activity must reference a place.' })
      }
      if (!item.placeId) continue
      const place = byId.get(item.placeId)
      if (!place) {
        err({ code: 'unknown_place', dayIndex, itemId: item.id, placeId: item.placeId, message: 'This activity does not match any place found for your stay.' })
        continue
      }
      // The invariant, re-checked from raw coordinates every time.
      if (!isWithinRadius(origin, place.location)) {
        err({ code: 'outside_radius', dayIndex, itemId: item.id, placeId: place.id, message: `"${place.name}" is more than 50 km from your accommodation.` })
      }
      if (item.kind === 'activity') {
        seenPlaces.set(place.id, (seenPlaces.get(place.id) ?? 0) + 1)
      }
      const hours = trustedHours(place)
      if (hours) {
        if (!openDuring(hours, day.date, start, end)) {
          err({ code: 'closed', dayIndex, itemId: item.id, placeId: place.id, message: `"${place.name}" is listed as closed for part of this time.` })
        }
      } else if (item.kind !== 'free') {
        warn({ code: 'hours_unknown', dayIndex, itemId: item.id, placeId: place.id, message: `Opening hours for "${place.name}" are not confirmed.` })
      }
    }
  })

  for (const [placeId, count] of seenPlaces) {
    if (count > 1) err({ code: 'duplicate_activity', placeId, message: `"${byId.get(placeId)?.name}" is scheduled ${count} times.` })
  }
  return issues
}

export const hasErrors = (issues: ItineraryIssue[]) => issues.some((i) => i.severity === 'error')

// ------------------------------------------------------- deterministic plan

const SLOT_START: Record<Pace, { morning: string; afternoon: string }> = {
  relaxed: { morning: '10:00', afternoon: '14:30' },
  balanced: { morning: '09:30', afternoon: '14:00' },
  packed: { morning: '09:00', afternoon: '13:45' },
}

const isMealPlace = (p: TripPlace) => p.category === 'food'
const isActivityPlace = (p: TripPlace) => p.category !== 'food' && p.category !== 'practical'

function priority(p: TripPlace, prefs: Preferences): number {
  let score = 0
  if (p.favourite) score += 100
  if (p.selected) score += 50
  score += p.interests.filter((i) => prefs.interests.includes(i)).length * 10
  if (prefs.settingPreference !== 'no_preference' && p.setting.value === prefs.settingPreference) score += 8
  if (prefs.childAgeRanges.length > 0 && p.interests.includes('family')) score += 5
  score -= p.distanceMeters / 10_000 // gentle preference for closer places
  return score
}

/** Places we'd suggest when the traveller hasn't selected enough. */
function suggestable(p: TripPlace, prefs: Preferences): boolean {
  if (!isActivityPlace(p)) return false
  if (prefs.transport === 'walking' && p.distanceMeters > WALKING_LIMIT_M) return false
  const minAge = minimumAge(p)
  const youngest = youngestChild(prefs)
  if (minAge !== null && youngest !== null && youngest < minAge) return false
  if (prefs.interests.length === 0) return true
  return p.interests.some((i) => prefs.interests.includes(i))
}

interface Slotting {
  slot: Slot
  earliest: number
  latestEnd: number
}

function trySlot(
  place: TripPlace,
  date: string,
  s: Slotting,
  cursor: number,
  from: { lat: number; lng: number },
  mode: TransportMode,
): { start: number; duration: number } | null {
  const travel = travelMinutes(distanceMeters(from, place.location), mode)
  const duration = place.durationMinutes.value
  let start = roundUp5(Math.max(s.earliest, cursor + travel))
  const hours = trustedHours(place)
  if (hours) {
    const todays = hours.filter((h) => h.day === dayOfWeek(date))
    const opening = todays.map((h) => toMinutes(h.open)).find((o) => o > start && o + duration <= s.latestEnd)
    if (!openDuring(hours, date, start, start + duration) && opening !== undefined) start = opening
    if (!openDuring(hours, date, start, start + duration)) return null
  }
  if (start + duration > s.latestEnd) return null
  return { start, duration }
}

/**
 * Builds a plan for the given dates. `exclude` lists place ids already used on
 * days that are being kept (for single-day regeneration).
 */
export function schedule(
  ctx: EngineContext,
  onlyDates?: string[],
  exclude: Set<string> = new Set(),
): { plan: PlanDay[]; warnings: string[] } {
  const prefs = ctx.preferences
  const allDates = tripDates(prefs.checkIn, prefs.checkOut)
  const dates = onlyDates ?? allDates
  const warnings: string[] = []

  const selected = ctx.places.filter((p) => (p.selected || p.favourite) && isActivityPlace(p) && !exclude.has(p.id))
  const extras = ctx.places.filter((p) => !p.selected && !p.favourite && suggestable(p, prefs) && !exclude.has(p.id))
  const pool = [...selected.sort((a, b) => priority(b, prefs) - priority(a, prefs)), ...extras.sort((a, b) => priority(b, prefs) - priority(a, prefs))]
  const used = new Set<string>()
  const meals = ctx.places.filter(isMealPlace)
  const usedMeals = new Set<string>()
  const pace = PACE_LIMITS[prefs.pace]

  const plan: PlanDay[] = dates.map((date) => {
    const idx = allDates.indexOf(date)
    const arrival = idx === 0
    const departure = idx === allDates.length - 1
    const times = SLOT_START[prefs.pace]
    const items: PlanItem[] = []
    let cursor = 0
    let at = ctx.accommodation.location
    let majors = 0
    const limit = departure ? (prefs.pace === 'relaxed' ? 0 : 1) : arrival ? 1 : pace

    const addActivity = (s: Slotting) => {
      if (majors >= limit) return
      // Prefer places near where we already are, so the day doesn't zig-zag.
      const candidates = pool
        .filter((p) => !used.has(p.id))
        .map((p) => ({ p, score: priority(p, prefs) - distanceMeters(at, p.location) / 5_000 }))
        .sort((a, b) => b.score - a.score)
      for (const { p } of candidates) {
        const fit = trySlot(p, date, s, cursor, at, prefs.transport)
        if (!fit) continue
        items.push({ slot: s.slot, kind: 'activity', placeId: p.id, startTime: fromMinutes(fit.start), durationMinutes: fit.duration })
        used.add(p.id)
        cursor = fit.start + fit.duration
        at = p.location
        majors++
        return
      }
    }

    const addMeal = (slot: 'lunch' | 'evening', earliest: number, latestEnd: number, duration: number) => {
      const s: Slotting = { slot, earliest, latestEnd }
      const youngest = youngestChild(prefs)
      const options = meals
        .filter((m) => !usedMeals.has(m.id))
        // A meal stop should be close to where the day already is, and suit the whole group.
        .filter((m) => distanceMeters(at, m.location) <= MEAL_DETOUR_LIMIT_M)
        .filter((m) => {
          const minAge = minimumAge(m)
          return minAge === null || youngest === null || youngest >= minAge
        })
        .sort((a, b) => Number(b.selected || b.favourite) - Number(a.selected || a.favourite) || distanceMeters(at, a.location) - distanceMeters(at, b.location))
      for (const m of options) {
        if (!trustedHours(m) && !(m.selected || m.favourite)) continue
        const fit = trySlot({ ...m, durationMinutes: { ...m.durationMinutes, value: duration } }, date, s, cursor, at, prefs.transport)
        if (!fit) continue
        items.push({ slot, kind: 'meal', placeId: m.id, startTime: fromMinutes(fit.start), durationMinutes: duration })
        usedMeals.add(m.id)
        cursor = fit.start + duration
        at = m.location
        return
      }
      const start = roundUp5(Math.max(earliest, cursor))
      if (start + duration <= latestEnd) {
        items.push({ slot, kind: 'meal', placeId: null, startTime: fromMinutes(start), durationMinutes: duration })
        cursor = start + duration
      }
    }

    if (departure) {
      addActivity({ slot: 'morning', earliest: toMinutes('08:30'), latestEnd: toMinutes(DEPARTURE_LATEST_END) })
    } else if (arrival) {
      addActivity({ slot: 'afternoon', earliest: toMinutes(ARRIVAL_START), latestEnd: toMinutes('18:30') })
      addMeal('evening', toMinutes('18:30'), toMinutes('21:30'), 90)
    } else {
      addActivity({ slot: 'morning', earliest: toMinutes(times.morning), latestEnd: toMinutes('12:30') })
      addMeal('lunch', toMinutes('12:15'), toMinutes('14:30'), 60)
      addActivity({ slot: 'afternoon', earliest: toMinutes(times.afternoon), latestEnd: toMinutes('17:30') })
      if (pace >= 3) addActivity({ slot: 'afternoon', earliest: toMinutes('15:00'), latestEnd: toMinutes('18:30') })
      addMeal('evening', toMinutes('18:45'), toMinutes('21:45'), 90)
    }
    if (majors === 0 && !departure) {
      const start = arrival ? toMinutes(ARRIVAL_START) : toMinutes(times.morning)
      if (start >= cursor) items.push({ slot: arrival ? 'afternoon' : 'morning', kind: 'free', placeId: null, startTime: fromMinutes(start), durationMinutes: 120 })
    }
    return { date, items }
  })

  const unscheduled = selected.filter((p) => !used.has(p.id))
  if (unscheduled.length > 0) {
    warnings.push(
      `${unscheduled.length} selected place${unscheduled.length === 1 ? '' : 's'} could not be fitted around your dates, pace and listed opening hours: ${unscheduled.map((p) => p.name).join(', ')}.`,
    )
  }
  if (selected.length === 0) {
    warnings.push('You have not selected any places yet, so this plan uses suggestions based on your interests.')
  }
  return { plan, warnings }
}

/** Rainy-day alternatives: an unused indoor place for each day with outdoor plans. */
export function addRainyDayNotes(itin: Itinerary, ctx: EngineContext): Itinerary {
  const byId = new Map(ctx.places.map((p) => [p.id, p]))
  const usedIds = new Set(itin.days.flatMap((d) => d.items.map((i) => i.placeId)).filter(Boolean))
  const indoor = ctx.places.filter((p) => isActivityPlace(p) && p.setting.value === 'indoor' && !usedIds.has(p.id))
  let k = 0
  for (const day of itin.days) {
    const outdoor = day.items.some((i) => i.placeId && byId.get(i.placeId)?.setting.value === 'outdoor')
    if (outdoor && indoor.length > 0) {
      const alt = indoor[k++ % indoor.length]!
      day.notes.push(`If the weather turns: ${alt.name} is indoors (${alt.category.replace('_', ' ')}). No forecast has been checked.`)
    }
  }
  return itin
}
