// Outbound HTTP for provider adapters: timeouts, bounded retries, a response
// size cap, and errors that never include credentials or full bodies.

export type FetchLike = typeof fetch

export class ProviderError extends Error {
  readonly provider: string
  readonly status: number | null
  readonly retryable: boolean

  constructor(
    provider: string,
    message: string,
    status: number | null,
    retryable: boolean,
  ) {
    super(`${provider}: ${message}`)
    this.name = 'ProviderError'
    this.provider = provider
    this.status = status
    this.retryable = retryable
  }
}

export interface RequestOptions {
  provider: string
  url: string
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: unknown
  /** Raw body (e.g. form-encoded); takes precedence over `body`. */
  rawBody?: string
  timeoutMs?: number
  retries?: number
  maxBytes?: number
  fetchImpl?: FetchLike
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function requestJson<T = unknown>(
  opts: RequestOptions,
): Promise<{ status: number; data: T }> {
  const {
    provider,
    url,
    method = 'GET',
    headers = {},
    timeoutMs = 8000,
    retries = 1,
    maxBytes = 2_000_000,
    fetchImpl = fetch,
  } = opts
  let lastError: ProviderError | null = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(250 * 2 ** (attempt - 1))
    let res: Response
    try {
      res = await fetchImpl(url, {
        method,
        headers: {
          Accept: 'application/json',
          ...(opts.rawBody === undefined && opts.body !== undefined
            ? { 'Content-Type': 'application/json' }
            : {}),
          ...headers,
        },
        body:
          opts.rawBody ??
          (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (err) {
      const timedOut =
        err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')
      lastError = new ProviderError(
        provider,
        timedOut ? 'request timed out' : 'network error',
        null,
        true,
      )
      continue
    }

    const text = await readCapped(res, maxBytes, provider)
    let data: unknown = null
    if (text.length > 0) {
      try {
        data = JSON.parse(text)
      } catch {
        throw new ProviderError(
          provider,
          `malformed JSON response (HTTP ${res.status})`,
          res.status,
          false,
        )
      }
    }

    if (res.ok) return { status: res.status, data: data as T }

    const retryable = res.status === 429 || res.status >= 500
    lastError = new ProviderError(provider, `HTTP ${res.status}`, res.status, retryable)
    // Hand non-retryable errors (and their parsed body) straight back.
    if (!retryable) {
      ;(lastError as ProviderError & { body?: unknown }).body = data
      throw lastError
    }
  }
  throw lastError ?? new ProviderError(provider, 'request failed', null, true)
}

async function readCapped(
  res: Response,
  maxBytes: number,
  provider: string,
): Promise<string> {
  const declared = Number(res.headers.get('content-length') ?? '0')
  if (declared > maxBytes)
    throw new ProviderError(provider, 'response too large', res.status, false)
  const buf = await res.arrayBuffer()
  if (buf.byteLength > maxBytes)
    throw new ProviderError(provider, 'response too large', res.status, false)
  return new TextDecoder().decode(buf)
}

/** Accepts only absolute http(s) URLs; anything else (javascript:, data:, relative) becomes null. */
export function safeExternalUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2000) return null
  try {
    const u = new URL(value)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null
  } catch {
    return null
  }
}

/** Strips control characters and trims provider-supplied text to a sane length. */
export function cleanText(value: unknown, max = 200): string | null {
  if (typeof value !== 'string') return null
  // oxlint-disable-next-line no-control-regex
  const s = value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return s === '' ? null : s.slice(0, max)
}
