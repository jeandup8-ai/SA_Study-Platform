// AI itinerary proposals.
//
// The model only ever *proposes* a plan made of internal place ids that we
// supplied. The server hydrates that plan from its own records and runs the
// full validator (50 km rule, dates, hours, duplicates, overlaps). Any error
// discards the proposal and the deterministic scheduler is used instead.
// The model is never asked for safety assessments.

import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import { formatDistance } from '../../shared/geo.js'
import type { Preferences, TripPlace } from '../../shared/types.js'
import type { PlanDay } from '../itinerary/engine.js'

export interface AiPlanInput {
  preferences: Preferences
  dates: string[]
  places: TripPlace[]
}

export interface AiProvider {
  readonly name: string
  proposePlan(input: AiPlanInput): Promise<PlanDay[]>
}

export class AiUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AiUnavailableError'
  }
}

const proposalSchema = z.object({
  days: z.array(
    z.object({
      date: z.string(),
      items: z.array(
        z.object({
          slot: z.enum(['morning', 'lunch', 'afternoon', 'evening']),
          kind: z.enum(['activity', 'meal', 'free']),
          placeId: z.string().nullable(),
          startTime: z.string(),
          durationMinutes: z.number().int(),
        }),
      ),
    }),
  ),
})

// Frozen, so it can be cached; nothing request-specific goes here.
const SYSTEM_PROMPT = `You arrange holiday itineraries from a fixed list of candidate places.

Rules:
- Use only placeId values from the candidates list. Never invent places, ids, prices, opening hours or bookings.
- Use the traveller's selected places first; add unselected candidates only if they fit the traveller's interests.
- Respect listed opening hours exactly. If hours are "unknown", you may schedule the place but prefer daytime.
- Each date in "dates" appears exactly once. The first date is arrival (nothing before 15:00); the last is departure (finish by 11:30).
- Respect the activity limit per day. Lunch and dinner are kind "meal" (placeId may be null for "your choice"). Use kind "free" for rest time with placeId null.
- Never schedule the same activity place twice.
- Leave realistic travel time between items using the distances given. startTime is 24-hour "HH:MM"; durationMinutes is a whole number.
- Group places that are close to each other on the same day.`

const MAX_CANDIDATES = 60

/**
 * Only planning facts go to the model. The free-text accessibility and
 * dietary notes are deliberately excluded: they may be special-category data
 * and the planner doesn't use them.
 */
export function buildUserMessage(input: AiPlanInput): string {
  const p = input.preferences
  const limit = { relaxed: 1, balanced: 2, packed: 3 }[p.pace]
  const candidates = [...input.places]
    .filter((x) => x.category !== 'practical')
    .sort(
      (a, b) =>
        Number(b.selected || b.favourite) - Number(a.selected || a.favourite) ||
        a.distanceMeters - b.distanceMeters,
    )
    .slice(0, MAX_CANDIDATES)
    .map((x) => ({
      placeId: x.id,
      name: x.name,
      category: x.category,
      selected: x.selected || x.favourite,
      distanceFromStay: formatDistance(x.distanceMeters),
      setting: x.setting.value,
      typicalVisitMinutes: x.durationMinutes.value,
      openingHours: x.openingHours
        ? x.openingHours.value
            .map(
              (h) =>
                `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][h.day]} ${h.open}-${h.close}`,
            )
            .join('; ')
        : 'unknown',
      suitability: x.suitability.map((s) => s.note),
    }))
  return JSON.stringify({
    dates: input.dates,
    traveller: {
      tripType: p.tripType,
      adults: p.adults,
      childAgeRanges: p.childAgeRanges,
      interests: p.interests,
      pace: p.pace,
      maxActivitiesPerDay: limit,
      transport: p.transport,
      settingPreference: p.settingPreference,
    },
    candidates,
  })
}

export class AnthropicAiProvider implements AiProvider {
  readonly name = 'anthropic'
  private readonly client: Anthropic
  private readonly model: string

  constructor(apiKey: string, model: string, client?: Anthropic) {
    // Bounded: 90 s per attempt (room for a long trip's plan), 1 retry on 408/409/429/5xx.
    this.client = client ?? new Anthropic({ apiKey, timeout: 90_000, maxRetries: 1 })
    this.model = model
  }

  async proposePlan(input: AiPlanInput): Promise<PlanDay[]> {
    let response
    try {
      response = await this.client.beta.messages.parse({
        model: this.model,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserMessage(input) }],
        output_config: { format: betaZodOutputFormat(proposalSchema) },
      })
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError)
        throw new AiUnavailableError('AI rate limited')
      if (err instanceof Anthropic.APIError)
        throw new AiUnavailableError(`AI request failed (${err.status ?? 'network'})`)
      throw new AiUnavailableError('AI request failed')
    }
    if (response.stop_reason === 'refusal')
      throw new AiUnavailableError('AI declined the request')
    if (response.stop_reason === 'max_tokens')
      throw new AiUnavailableError('AI response was truncated')
    const parsed = response.parsed_output
    if (!parsed) throw new AiUnavailableError('AI response did not match the schema')
    const checked = proposalSchema.safeParse(parsed)
    if (!checked.success)
      throw new AiUnavailableError('AI response did not match the schema')
    return checked.data.days
  }
}
