/**
 * Resolves to `fallback` if `work` has not settled within `ms`.
 *
 * The public site reads a few things from the database (subject coverage,
 * live prices). Those requests can stall rather than fail -- a captive
 * portal, a flaky mobile connection, or the client retrying underneath us --
 * and a stalled request leaves a marketing section sitting on loading
 * skeletons with no way out. A rejection is easy to catch; a hang is not,
 * so it gets a deadline.
 */
export async function withTimeout<T>(work: Promise<T>, fallback: T, ms = 6000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms)
  })
  try {
    return await Promise.race([work, deadline])
  } catch {
    return fallback
  } finally {
    if (timer) clearTimeout(timer)
  }
}
