// Fixed-window, in-process rate limiter. Good enough for a single instance;
// put a shared limiter (or the platform's) in front when running several.

export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>()
  private readonly limit: number
  private readonly windowMs: number

  constructor(limit: number, windowMs: number) {
    this.limit = limit
    this.windowMs = windowMs
  }

  /** Returns seconds to wait, or 0 if allowed. */
  check(key: string, now = Date.now()): number {
    if (this.hits.size > 10_000) this.sweep(now)
    const entry = this.hits.get(key)
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs })
      return 0
    }
    entry.count++
    return entry.count > this.limit ? Math.ceil((entry.resetAt - now) / 1000) : 0
  }

  private sweep(now: number) {
    for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k)
  }
}
