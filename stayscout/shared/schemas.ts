// Request validation. Every server route parses its input with one of these.

import { z } from 'zod'

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), 'Not a real date')
  .refine((s) => new Date(`${s}T00:00:00Z`).toISOString().startsWith(s), 'Not a real date')

export const MAX_TRIP_NIGHTS = 30

export const interestSchema = z.enum([
  'beaches',
  'nature',
  'wildlife',
  'food',
  'culture',
  'shopping',
  'history',
  'adventure',
  'nightlife',
  'wellness',
  'viewpoints',
  'family',
])

const optionalText = z
  .string()
  .trim()
  .max(300)
  .transform((s) => (s === '' ? null : s))
  .nullable()
  .default(null)

export const preferencesSchema = z
  .object({
    checkIn: isoDate,
    checkOut: isoDate,
    adults: z.number().int().min(1).max(20),
    childAgeRanges: z.array(z.enum(['0-2', '3-5', '6-12', '13-17'])).max(10).default([]),
    tripType: z
      .enum(['honeymoon', 'family', 'solo', 'group', 'adventure', 'relaxation', 'general'])
      .default('general'),
    budget: z
      .object({
        amount: z.number().positive().max(1_000_000),
        currency: z
          .string()
          .regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code')
          .default('USD'),
      })
      .nullable()
      .default(null),
    transport: z
      .enum(['walking', 'public', 'rental_car', 'taxi', 'guided', 'undecided'])
      .default('undecided'),
    interests: z.array(interestSchema).max(12).default([]),
    pace: z.enum(['relaxed', 'balanced', 'packed']).default('balanced'),
    accessibilityNeeds: optionalText,
    dietaryPreferences: optionalText,
    settingPreference: z.enum(['indoor', 'outdoor', 'no_preference']).default('no_preference'),
    language: z
      .string()
      .regex(/^[a-z]{2}(-[A-Z]{2})?$/)
      .default('en'),
  })
  .superRefine((p, ctx) => {
    const nights = nightsBetween(p.checkIn, p.checkOut)
    if (nights < 1) {
      ctx.addIssue({ code: 'custom', path: ['checkOut'], message: 'Check-out must be after check-in' })
    } else if (nights > MAX_TRIP_NIGHTS) {
      ctx.addIssue({
        code: 'custom',
        path: ['checkOut'],
        message: `Trips are limited to ${MAX_TRIP_NIGHTS} nights`,
      })
    }
  })

export type PreferencesInput = z.input<typeof preferencesSchema>

export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = Date.parse(`${checkIn}T00:00:00Z`)
  const b = Date.parse(`${checkOut}T00:00:00Z`)
  return Math.round((b - a) / 86_400_000)
}

export const accommodationSearchSchema = z.object({
  query: z.string().trim().min(2, 'Type at least 2 characters').max(120),
  kind: z
    .enum(['hotel', 'resort', 'lodge', 'guesthouse', 'apartment', 'other', 'destination', 'any'])
    .default('any'),
})

export const accommodationSelectSchema = z.object({
  provider: z.enum(['demo', 'google']),
  providerPlaceId: z.string().min(1).max(300),
})

export const confirmAccommodationSchema = z.object({
  /** Required when the selection is an area centre rather than a property. */
  acknowledgeAreaCentre: z.boolean().default(false),
})

export const selectionSchema = z.object({
  placeId: z.string().min(1).max(100),
  selected: z.boolean().optional(),
  favourite: z.boolean().optional(),
})

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)

/** A client-submitted edit. Only ids, order and times; titles/notes are re-derived server-side. */
export const itineraryEditSchema = z.object({
  version: z.number().int().min(1),
  days: z
    .array(
      z.object({
        date: isoDate,
        items: z
          .array(
            z.object({
              id: z.string().min(1).max(100),
              slot: z.enum(['morning', 'lunch', 'afternoon', 'evening']),
              kind: z.enum(['activity', 'meal', 'free']),
              placeId: z.string().min(1).max(100).nullable(),
              startTime: hhmm,
              durationMinutes: z.number().int().min(15).max(600),
            }),
          )
          .max(8),
      }),
    )
    .max(MAX_TRIP_NIGHTS + 1),
})

export type ItineraryEdit = z.infer<typeof itineraryEditSchema>

export const captureSchema = z.object({
  orderId: z.string().regex(/^[A-Z0-9]{5,40}$/),
})
