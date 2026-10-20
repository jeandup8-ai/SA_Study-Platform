// Trip business logic. Routes authenticate and parse; this file decides.

import { createHash, randomBytes, randomUUID } from 'node:crypto'
import {
  MAX_RADIUS_M,
  isValidLatLng,
  isWithinRadius,
  distanceMeters,
  partitionByRadius,
} from '../shared/geo.js'
import type { ItineraryEdit } from '../shared/schemas.js'
import type {
  Accommodation,
  AccommodationKind,
  Interest,
  Itinerary,
  ItineraryIssue,
  PlaceCategory,
  PlaceRecord,
  Preferences,
  ProviderStatus,
  SafetyPanel,
  TripPlace,
  TripView,
} from '../shared/types.js'
import type { Config } from './config.js'
import {
  accommodationKey,
  addRainyDayNotes,
  hasErrors,
  hydratePlan,
  schedule,
  tripDates,
  validateItinerary,
  type EngineContext,
  type PlanDay,
} from './itinerary/engine.js'
import type { AiProvider } from './providers/ai.js'
import { evaluateOrder, type PaymentProvider } from './providers/payments.js'
import type { PlaceCandidate, PlacesProvider } from './providers/places/types.js'
import { buildSafetyPanel, type SafetyProvider } from './providers/safety.js'
import type { Store, TripRow } from './store/types.js'

export class ServiceError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export interface Deps {
  config: Config
  store: Store
  places: PlacesProvider
  ai: AiProvider | null
  payments: PaymentProvider | null
  safety: SafetyProvider
  now?: () => Date
}

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
export const newToken = () => randomBytes(32).toString('base64url')
export const placeIdFor = (provider: string, providerPlaceId: string) =>
  `p_${sha256(`${provider}:${providerPlaceId}`).slice(0, 16)}`

const INTEREST_CATEGORIES: Record<Interest, PlaceCategory[]> = {
  beaches: ['beach'],
  nature: ['nature', 'park'],
  wildlife: ['wildlife'],
  food: ['food'],
  culture: ['culture'],
  shopping: ['shopping'],
  history: ['culture'],
  adventure: ['adventure', 'tour'],
  nightlife: ['food', 'shopping'],
  wellness: ['wellness'],
  viewpoints: ['nature'],
  family: ['family'],
}

const MAX_PLACES_PER_TRIP = 80
const FEW_RESULTS = 6

export class TripService {
  private readonly d: Deps
  private readonly now: () => Date

  constructor(deps: Deps) {
    this.d = deps
    this.now = deps.now ?? (() => new Date())
  }

  // ------------------------------------------------------------ status

  status(): ProviderStatus {
    const { config, payments, ai, safety, places, store } = this.d
    return {
      places: { mode: places.isSample ? 'demo' : 'live', provider: places.name },
      ai: { mode: ai ? 'live' : 'off', provider: ai?.name ?? null },
      payments: {
        mode: payments ? payments.mode : 'off',
        provider: payments?.name ?? null,
        clientId: payments?.clientId ?? null, // a PayPal client id is public by design
        price: { amount: config.GUIDE_PRICE, currency: config.GUIDE_CURRENCY },
      },
      safety: {
        mode: safety.live ? 'live' : 'off',
        provider: safety.live ? safety.name : null,
      },
      storage: store.kind,
    }
  }

  // ----------------------------------------------------- accommodation

  async searchAccommodation(query: string, kind: AccommodationKind | 'any') {
    const raw = await this.d.places.searchAccommodation(query, kind)
    // Never offer a candidate whose coordinates we couldn't use.
    const candidates = raw.filter((c) => isValidLatLng(c.location)).slice(0, 10)
    return { candidates, isSample: this.d.places.isSample, provider: this.d.places.name }
  }

  private async resolve(
    provider: string,
    providerPlaceId: string,
  ): Promise<Accommodation> {
    if (provider !== this.d.places.name) {
      throw new ServiceError(
        400,
        'provider_mismatch',
        'That result came from a different data provider. Search again.',
      )
    }
    const c = await this.d.places.resolveAccommodation(providerPlaceId)
    if (!c)
      throw new ServiceError(
        404,
        'accommodation_not_found',
        'We could not find that property. Search again.',
      )
    if (!isValidLatLng(c.location)) {
      throw new ServiceError(
        422,
        'accommodation_location_invalid',
        'That property has no usable location, so we cannot measure distances from it.',
      )
    }
    // Coordinates always come from the provider, never from the browser.
    return {
      ...c,
      confirmed: false,
      confirmedAt: null,
      resolvedAt: this.now().toISOString(),
    }
  }

  async createTrip(
    ownerHash: string,
    sel: { provider: string; providerPlaceId: string },
  ): Promise<TripRow> {
    const accommodation = await this.resolve(sel.provider, sel.providerPlaceId)
    const now = this.now().toISOString()
    const row: TripRow = {
      id: randomUUID(),
      ownerHash,
      createdAt: now,
      updatedAt: now,
      accommodation,
      preferences: null,
      itinerary: null,
      discovery: null,
      shareTokenHash: null,
    }
    await this.d.store.createTrip(row)
    return row
  }

  /**
   * Changing the stay re-measures every saved place from the new location and
   * removes anything now outside 50 km — from places, selections and the plan.
   */
  async changeAccommodation(
    trip: TripRow,
    sel: { provider: string; providerPlaceId: string },
  ) {
    const accommodation = await this.resolve(sel.provider, sel.providerPlaceId)
    const rows = await this.d.store.getPlaces(trip.id)
    const removed = rows.filter(
      (r) => !isWithinRadius(accommodation.location, r.record.location),
    )
    await this.d.store.deletePlaces(
      trip.id,
      removed.map((r) => r.record.id),
    )
    const removedIds = new Set(removed.map((r) => r.record.id))

    let itinerary = trip.itinerary
    let removedFromPlan = 0
    if (itinerary) {
      const plan: PlanDay[] = itinerary.days.map((d) => ({
        date: d.date,
        items: d.items.filter((i) => {
          const drop = i.placeId !== null && removedIds.has(i.placeId)
          if (drop) removedFromPlan++
          return !drop
        }),
      }))
      const updated = { ...trip, accommodation }
      const ctx = await this.context(updated)
      itinerary = ctx
        ? hydratePlan(plan, ctx, {
            generatedBy: itinerary.generatedBy,
            version: itinerary.version + 1,
            warnings: [
              `Your accommodation changed. ${removedFromPlan} planned activit${removedFromPlan === 1 ? 'y was' : 'ies were'} removed because ${removedFromPlan === 1 ? 'it is' : 'they are'} now more than 50 km away. Regenerate for a fresh plan.`,
            ],
          })
        : null
    }
    const saved = await this.d.store.updateTrip(
      trip.id,
      { accommodation, itinerary },
      this.now().toISOString(),
    )
    return {
      trip: saved!,
      removedPlaces: removed.map((r) => r.record.name),
      removedFromPlan,
    }
  }

  async confirmAccommodation(trip: TripRow, acknowledgeAreaCentre: boolean) {
    const a = trip.accommodation
    if (!a)
      throw new ServiceError(409, 'no_accommodation', 'Choose your accommodation first.')
    if (a.isAreaCentre && !acknowledgeAreaCentre) {
      throw new ServiceError(
        422,
        'area_centre_unacknowledged',
        'This is a town or area centre, not your property. Confirm that distances should be measured from this point, or search for your accommodation by name.',
      )
    }
    const accommodation = { ...a, confirmed: true, confirmedAt: this.now().toISOString() }
    return (await this.d.store.updateTrip(
      trip.id,
      { accommodation },
      this.now().toISOString(),
    ))!
  }

  // -------------------------------------------------------- preferences

  async setPreferences(trip: TripRow, prefs: Preferences) {
    const datesChanged =
      trip.preferences &&
      (trip.preferences.checkIn !== prefs.checkIn ||
        trip.preferences.checkOut !== prefs.checkOut)
    return (await this.d.store.updateTrip(
      trip.id,
      { preferences: prefs, ...(datesChanged ? { itinerary: null } : {}) },
      this.now().toISOString(),
    ))!
  }

  // ----------------------------------------------------------- discovery

  async discover(trip: TripRow) {
    const a = this.requireConfirmed(trip)
    const categories = [
      ...new Set(
        (trip.preferences?.interests ?? []).flatMap((i) => INTEREST_CATEGORIES[i]),
      ),
    ]
    let raw: PlaceCandidate[]
    try {
      // The radius is always the server constant; nothing from the request.
      raw = await this.d.places.searchNearby(
        a.location,
        MAX_RADIUS_M,
        categories,
        trip.preferences,
      )
    } catch {
      throw new ServiceError(
        503,
        'places_unavailable',
        'The place search service is unavailable right now. Please try again shortly.',
      )
    }

    const wellFormed = raw.filter(
      (c) =>
        typeof c.name === 'string' &&
        c.name.length > 0 &&
        typeof c.providerPlaceId === 'string',
    )
    const unique = new Map<string, PlaceCandidate>()
    for (const c of wellFormed) unique.set(`${c.provider}:${c.providerPlaceId}`, c)

    // Enforced after merging every provider's results, on our own maths.
    const { qualifying, rejected } = partitionByRadius(a.location, [...unique.values()])
    const records: PlaceRecord[] = qualifying
      .sort((x, y) => x.distanceMeters - y.distanceMeters)
      .slice(0, MAX_PLACES_PER_TRIP)
      .map(({ distanceMeters: _d, ...c }) => ({
        ...c,
        id: placeIdFor(c.provider, c.providerPlaceId),
        location: c.location as { lat: number; lng: number },
      }))
    await this.d.store.replacePlaces(trip.id, records)

    const reasons: Record<string, number> = {}
    for (const r of rejected) reasons[r.reason] = (reasons[r.reason] ?? 0) + 1
    const discovery: NonNullable<TripView['discovery']> = {
      ranAt: this.now().toISOString(),
      provider: this.d.places.name,
      isSample: this.d.places.isSample,
      rejectedCount: rejected.length,
      rejectedReasons: reasons,
      note:
        records.length === 0
          ? 'No places were found within 50 km of your stay. We do not widen the radius, so there is nothing to plan around yet.'
          : records.length < FEW_RESULTS
            ? `Only ${records.length} place${records.length === 1 ? '' : 's'} found within 50 km of your stay. We do not widen the radius to pad the list.`
            : null,
    }
    // Remove plan items for places that disappeared from the new results.
    const keep = new Set(records.map((r) => r.id))
    let itinerary = trip.itinerary
    if (
      itinerary &&
      itinerary.days.some((d) => d.items.some((i) => i.placeId && !keep.has(i.placeId)))
    ) {
      itinerary = null
    }
    return (await this.d.store.updateTrip(
      trip.id,
      { discovery, itinerary },
      this.now().toISOString(),
    ))!
  }

  async setSelection(
    trip: TripRow,
    placeId: string,
    sel: { selected?: boolean; favourite?: boolean },
  ) {
    const ok = await this.d.store.setSelection(trip.id, placeId, sel)
    if (!ok)
      throw new ServiceError(
        404,
        'place_not_found',
        'That place is not part of this trip.',
      )
  }

  // ------------------------------------------------------------- views

  private async tripPlaces(trip: TripRow): Promise<TripPlace[]> {
    const a = trip.accommodation
    if (!a) return []
    const now = this.now().getTime()
    const rows = await this.d.store.getPlaces(trip.id)
    const out: TripPlace[] = []
    for (const r of rows) {
      if (r.record.expiresAt && Date.parse(r.record.expiresAt) < now) continue
      // Defensive: re-measure on every read, never trust a stored distance.
      if (!isWithinRadius(a.location, r.record.location)) continue
      out.push({
        ...r.record,
        distanceMeters: distanceMeters(a.location, r.record.location),
        selected: r.selected,
        favourite: r.favourite,
      })
    }
    return out.sort((x, y) => x.distanceMeters - y.distanceMeters)
  }

  private async context(trip: TripRow): Promise<EngineContext | null> {
    if (!trip.accommodation || !trip.preferences) return null
    return {
      accommodation: trip.accommodation,
      preferences: trip.preferences,
      places: await this.tripPlaces(trip),
      now: this.now(),
      newId: () => `i_${randomBytes(6).toString('hex')}`,
    }
  }

  async entitlement(trip: TripRow) {
    if (!this.d.payments)
      return { fullGuide: true, reason: 'payments_not_configured' as const }
    if (await this.d.store.hasPaidOrder(trip.id))
      return { fullGuide: true, reason: 'paid' as const }
    return { fullGuide: false, reason: 'preview' as const }
  }

  async view(trip: TripRow, opts: { readOnly?: boolean } = {}): Promise<TripView> {
    const places = await this.tripPlaces(trip)
    const ent = await this.entitlement(trip)
    let itinerary = trip.itinerary
    let issues: ItineraryIssue[] = []
    if (itinerary && trip.accommodation && trip.preferences) {
      issues = validateItinerary(itinerary, {
        accommodation: trip.accommodation,
        preferences: trip.preferences,
        places,
        now: this.now(),
        newId: () => '',
      })
    }
    let lockedDays = 0
    if (itinerary && !ent.fullGuide && itinerary.days.length > 1) {
      lockedDays = itinerary.days.length - 1
      itinerary = { ...itinerary, days: itinerary.days.slice(0, 1) }
    }
    return {
      id: trip.id,
      createdAt: trip.createdAt,
      updatedAt: trip.updatedAt,
      accommodation: trip.accommodation,
      preferences: opts.readOnly ? null : trip.preferences,
      places: opts.readOnly
        ? places.filter((p) =>
            itinerary?.days.some((d) => d.items.some((i) => i.placeId === p.id)),
          )
        : places,
      discovery: trip.discovery,
      itinerary,
      issues,
      entitlement: { ...ent, lockedDays },
      shareEnabled: trip.shareTokenHash !== null,
      readOnly: Boolean(opts.readOnly),
    }
  }

  // ---------------------------------------------------------- itinerary

  private requireConfirmed(trip: TripRow): Accommodation {
    const a = trip.accommodation
    if (!a || !a.confirmed) {
      throw new ServiceError(
        409,
        'accommodation_unconfirmed',
        'Confirm your accommodation location before discovering places or planning.',
      )
    }
    return a
  }

  private async requireContext(trip: TripRow): Promise<EngineContext> {
    this.requireConfirmed(trip)
    const ctx = await this.context(trip)
    if (!ctx)
      throw new ServiceError(
        409,
        'preferences_missing',
        'Tell us your dates and preferences first.',
      )
    if (ctx.places.length === 0)
      throw new ServiceError(
        409,
        'no_places',
        'There are no places within 50 km to plan with yet.',
      )
    return ctx
  }

  private async save(
    trip: TripRow,
    itin: Itinerary,
    ctx: EngineContext,
  ): Promise<{ trip: TripRow; issues: ItineraryIssue[] }> {
    const issues = validateItinerary(itin, ctx)
    if (hasErrors(issues)) {
      throw new ServiceError(
        422,
        'itinerary_invalid',
        'This plan breaks one or more rules and was not saved.',
        issues,
      )
    }
    const saved = await this.d.store.updateTrip(
      trip.id,
      { itinerary: itin },
      this.now().toISOString(),
    )
    return { trip: saved!, issues }
  }

  async generate(trip: TripRow, opts: { useAi: boolean }) {
    const ctx = await this.requireContext(trip)
    const version = (trip.itinerary?.version ?? 0) + 1
    const warnings: string[] = []

    if (opts.useAi && this.d.ai) {
      try {
        const proposal = await this.d.ai.proposePlan({
          preferences: ctx.preferences,
          dates: tripDates(ctx.preferences.checkIn, ctx.preferences.checkOut),
          places: ctx.places,
        })
        const known = new Set(ctx.places.map((p) => p.id))
        const invented = proposal
          .flatMap((d) => d.items)
          .filter((i) => i.placeId !== null && !known.has(i.placeId))
        if (invented.length === 0) {
          const itin = addRainyDayNotes(
            hydratePlan(proposal, ctx, { generatedBy: 'ai', version }),
            ctx,
          )
          const issues = validateItinerary(itin, ctx)
          if (!hasErrors(issues)) return this.save(trip, itin, ctx)
          warnings.push(
            `The AI draft broke ${issues.filter((i) => i.severity === 'error').length} planning rule(s), so StayScout's built-in planner was used instead.`,
          )
        } else {
          warnings.push(
            'The AI draft referenced places that are not in your results, so it was discarded and StayScout’s built-in planner was used instead.',
          )
        }
      } catch {
        warnings.push(
          'The AI planner was unavailable, so StayScout’s built-in planner was used.',
        )
      }
    }

    const { plan, warnings: w } = schedule(ctx)
    const itin = addRainyDayNotes(
      hydratePlan(plan, ctx, {
        generatedBy: 'deterministic',
        version,
        warnings: [...warnings, ...w],
      }),
      ctx,
    )
    return this.save(trip, itin, ctx)
  }

  /** Rebuilds one day, leaving every other day exactly as it was. */
  async regenerateDay(trip: TripRow, dayIndex: number) {
    const ctx = await this.requireContext(trip)
    const current = trip.itinerary
    if (!current) throw new ServiceError(409, 'no_itinerary', 'Generate a plan first.')
    const day = current.days[dayIndex]
    if (!day)
      throw new ServiceError(404, 'day_not_found', 'That day is not in your plan.')
    const usedElsewhere = new Set(
      current.days.flatMap((d, i) =>
        i === dayIndex
          ? []
          : d.items.map((x) => x.placeId).filter((x): x is string => !!x),
      ),
    )
    // Rotate: avoid repeating what this day had, if there are alternatives.
    const previous = new Set(
      day.items.map((x) => x.placeId).filter((x): x is string => !!x),
    )
    let { plan } = schedule(ctx, [day.date], new Set([...usedElsewhere, ...previous]))
    if (plan[0]!.items.every((i) => i.kind !== 'activity'))
      plan = schedule(ctx, [day.date], usedElsewhere).plan
    const plans: PlanDay[] = current.days.map((d, i) =>
      i === dayIndex ? plan[0]! : { date: d.date, items: d.items },
    )
    const itin = addRainyDayNotes(
      hydratePlan(plans, ctx, {
        generatedBy: current.generatedBy,
        version: current.version + 1,
        warnings: current.warnings,
      }),
      ctx,
    )
    // Keep the other days' notes as they were.
    itin.days = itin.days.map((d, i) =>
      i === dayIndex ? d : { ...d, notes: current.days[i]!.notes },
    )
    return this.save(trip, itin, ctx)
  }

  async editItinerary(trip: TripRow, edit: ItineraryEdit) {
    const ctx = await this.requireContext(trip)
    const current = trip.itinerary
    if (!current) throw new ServiceError(409, 'no_itinerary', 'Generate a plan first.')
    if (edit.version !== current.version) {
      throw new ServiceError(
        409,
        'version_conflict',
        'This plan changed in another tab. Reload to see the latest version.',
      )
    }
    const itin = hydratePlan(edit.days, ctx, {
      generatedBy: current.generatedBy,
      version: current.version + 1,
      warnings: [],
    })
    itin.days = itin.days.map((d) => ({
      ...d,
      notes: current.days.find((c) => c.date === d.date)?.notes ?? d.notes,
    }))
    return this.save(trip, itin, ctx)
  }

  async exportableView(trip: TripRow): Promise<TripView> {
    const ent = await this.entitlement(trip)
    if (!ent.fullGuide)
      throw new ServiceError(
        402,
        'payment_required',
        'Unlock the complete guide to download it.',
      )
    const view = await this.view(trip)
    if (!view.itinerary)
      throw new ServiceError(409, 'no_itinerary', 'Generate a plan first.')
    if (view.itinerary.accommodationKey !== accommodationKey(view.accommodation!)) {
      throw new ServiceError(
        409,
        'itinerary_stale',
        'Your accommodation changed since this plan was made. Regenerate it first.',
      )
    }
    if (hasErrors(view.issues)) {
      throw new ServiceError(
        422,
        'itinerary_invalid',
        'This plan no longer passes validation and cannot be exported.',
        view.issues,
      )
    }
    return view
  }

  async safety(trip: TripRow): Promise<SafetyPanel> {
    const a = this.requireConfirmed(trip)
    const places = await this.tripPlaces(trip)
    return buildSafetyPanel(
      this.d.safety,
      a,
      [...new Set(places.map((p) => p.category))],
      this.now(),
    )
  }

  // ------------------------------------------------------------- sharing

  async enableShare(trip: TripRow): Promise<string> {
    const token = newToken()
    await this.d.store.updateTrip(
      trip.id,
      { shareTokenHash: sha256(token) },
      this.now().toISOString(),
    )
    return token
  }

  async disableShare(trip: TripRow) {
    await this.d.store.updateTrip(
      trip.id,
      { shareTokenHash: null },
      this.now().toISOString(),
    )
  }

  // ------------------------------------------------------------ payments

  async createCheckout(trip: TripRow) {
    const payments = this.d.payments
    if (!payments)
      throw new ServiceError(
        409,
        'payments_off',
        'Payments are not configured; the full guide is already unlocked.',
      )
    if (await this.d.store.hasPaidOrder(trip.id))
      throw new ServiceError(409, 'already_paid', 'This guide is already unlocked.')
    const { GUIDE_PRICE: amount, GUIDE_CURRENCY: currency } = this.d.config
    let snap
    try {
      snap = await payments.createOrder({
        tripId: trip.id,
        amount,
        currency,
        requestId: `create-${trip.id}-${randomBytes(6).toString('hex')}`,
        description: `StayScout complete guide — ${trip.accommodation?.name ?? 'your stay'}`,
      })
    } catch {
      throw new ServiceError(
        503,
        'payments_unavailable',
        'The payment service is unavailable. You have not been charged.',
      )
    }
    if (!snap.orderId)
      throw new ServiceError(
        502,
        'payments_bad_response',
        'The payment service returned an unexpected response.',
      )
    const now = this.now().toISOString()
    await this.d.store.createOrder({
      id: randomUUID(),
      tripId: trip.id,
      provider: payments.name,
      providerOrderId: snap.orderId,
      amount,
      currency,
      status: 'created',
      captureId: null,
      createdAt: now,
      updatedAt: now,
    })
    return { orderId: snap.orderId }
  }

  /** Idempotent: repeat calls (double clicks, retried callbacks) return the same outcome. */
  async captureCheckout(trip: TripRow, orderId: string) {
    const payments = this.d.payments
    if (!payments)
      throw new ServiceError(409, 'payments_off', 'Payments are not configured.')
    const order = await this.d.store.getOrderByProviderId(payments.name, orderId)
    if (!order || order.tripId !== trip.id)
      throw new ServiceError(
        404,
        'order_not_found',
        'We have no record of that order for this guide.',
      )
    if (order.status === 'paid') return { status: 'paid' as const }

    let snap
    try {
      snap = await payments.captureOrder(orderId, `capture-${order.id}`)
    } catch {
      throw new ServiceError(
        503,
        'payments_unavailable',
        'We could not confirm the payment yet. If you were charged, it will be applied once confirmed — try again in a moment.',
      )
    }
    const outcome = evaluateOrder(snap, {
      tripId: trip.id,
      amount: order.amount,
      currency: order.currency,
    })
    const now = this.now().toISOString()
    switch (outcome.state) {
      case 'paid':
        await this.d.store.updateOrder(order.id, 'paid', outcome.captureId, now)
        return { status: 'paid' as const }
      case 'pending':
        await this.d.store.updateOrder(order.id, 'pending', null, now)
        return { status: 'pending' as const }
      case 'awaiting_approval':
        return { status: 'awaiting_approval' as const }
      case 'failed':
        await this.d.store.updateOrder(order.id, 'failed', null, now)
        return { status: 'failed' as const, reason: outcome.reason }
      case 'mismatch':
        // Do not unlock; record for investigation.
        await this.d.store.updateOrder(order.id, 'failed', null, now)
        console.warn(`[payments] order ${order.id} rejected: ${outcome.reason}`)
        return {
          status: 'failed' as const,
          reason: 'The payment could not be matched to this guide. Contact support.',
        }
    }
  }
}
