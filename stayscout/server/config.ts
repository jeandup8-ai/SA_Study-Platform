// Environment validation. Everything here is server-only; none of it is ever
// sent to the browser except the fields in publicStatus().

import { z } from 'zod'

const emptyToUndefined = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? undefined : v
const optional = z.preprocess(emptyToUndefined, z.string().optional())

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(8787),
    PUBLIC_BASE_URL: z.preprocess(emptyToUndefined, z.url().optional()),
    DATABASE_URL: optional,
    DATABASE_SSL: z.preprocess(
      emptyToUndefined,
      z.enum(['true', 'false']).default('false'),
    ),

    PLACES_PROVIDER: z.preprocess(
      emptyToUndefined,
      z.enum(['demo', 'google']).default('demo'),
    ),
    GOOGLE_MAPS_API_KEY: optional,

    AI_PROVIDER: z.preprocess(
      emptyToUndefined,
      z.enum(['none', 'anthropic']).default('none'),
    ),
    ANTHROPIC_API_KEY: optional,
    ANTHROPIC_MODEL: z.preprocess(
      emptyToUndefined,
      z.string().default('claude-opus-5-5'),
    ),

    PAYMENTS_PROVIDER: z.preprocess(
      emptyToUndefined,
      z.enum(['none', 'paypal']).default('none'),
    ),
    PAYPAL_ENV: z.preprocess(
      emptyToUndefined,
      z.enum(['sandbox', 'live']).default('sandbox'),
    ),
    PAYPAL_CLIENT_ID: optional,
    PAYPAL_CLIENT_SECRET: optional,
    /** From the PayPal app's Webhooks section; enables POST /api/webhooks/paypal. */
    PAYPAL_WEBHOOK_ID: optional,
    /** Live PayPal stays off unless this is explicitly "true", even with live credentials. */
    PAYPAL_LIVE_ENABLED: z.preprocess(
      emptyToUndefined,
      z.enum(['true', 'false']).default('false'),
    ),
    GUIDE_PRICE: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .regex(/^\d+\.\d{2}$/)
        .default('9.00'),
    ),
    GUIDE_CURRENCY: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .regex(/^[A-Z]{3}$/)
        .default('USD'),
    ),

    SAFETY_PROVIDER: z.preprocess(
      emptyToUndefined,
      z.enum(['none', 'fcdo']).default('none'),
    ),

    /** Multiplies every rate limit. Raise only for load or end-to-end testing. */
    RATE_LIMIT_MULTIPLIER: z.preprocess(
      emptyToUndefined,
      z.coerce.number().min(1).max(1000).default(1),
    ),
    /** Trips untouched for this many days are deleted (matches the owner cookie's lifetime). */
    TRIP_RETENTION_DAYS: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(1).max(3650).default(365),
    ),
    TRUST_PROXY: z.preprocess(
      emptyToUndefined,
      z.enum(['true', 'false']).default('false'),
    ),
  })
  .superRefine((env, ctx) => {
    if (env.PLACES_PROVIDER === 'google' && !env.GOOGLE_MAPS_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['GOOGLE_MAPS_API_KEY'],
        message: 'Required when PLACES_PROVIDER=google',
      })
    }
    if (env.AI_PROVIDER === 'anthropic' && !env.ANTHROPIC_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['ANTHROPIC_API_KEY'],
        message: 'Required when AI_PROVIDER=anthropic',
      })
    }
    if (env.PAYMENTS_PROVIDER === 'paypal') {
      for (const key of ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'] as const) {
        if (!env[key]) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: 'Required when PAYMENTS_PROVIDER=paypal',
          })
        }
      }
      if (env.PAYPAL_ENV === 'live' && env.PAYPAL_LIVE_ENABLED !== 'true') {
        ctx.addIssue({
          code: 'custom',
          path: ['PAYPAL_LIVE_ENABLED'],
          message:
            'PAYPAL_ENV=live also requires PAYPAL_LIVE_ENABLED=true (see README before enabling)',
        })
      }
    }
    if (env.NODE_ENV === 'production' && !env.PUBLIC_BASE_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['PUBLIC_BASE_URL'],
        message: 'Required in production',
      })
    }
  })

export type Config = z.infer<typeof envSchema>

export function loadConfig(
  source: Record<string, string | undefined> = process.env,
): Config {
  const parsed = envSchema.safeParse(source)
  if (!parsed.success) {
    // Name the variables, never print their values.
    const problems = parsed.error.issues.map(
      (i) => `  - ${i.path.join('.')}: ${i.message}`,
    )
    throw new Error(`Invalid StayScout configuration:\n${problems.join('\n')}`)
  }
  return parsed.data
}
