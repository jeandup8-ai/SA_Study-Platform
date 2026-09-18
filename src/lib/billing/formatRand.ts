/**
 * Formats a price in cents as rand, with thousands grouped.
 *
 * Without grouping this renders "R1199", which looks like a typo on a
 * pricing page and reads as a different number at a glance. The comma is
 * chosen to match the wording already published in the Terms of Service
 * ("R149 per month or R1,199 per year") so the product does not contradict
 * its own legal page.
 *
 * Whole rand only: every current plan is priced in whole rand, and showing
 * ",00" on a marketing page adds noise without adding information.
 */
export function formatRand(cents: number): string {
  const rand = Math.round(cents / 100)
  return `R${rand.toLocaleString('en-ZA').replace(/ /g, ',').replace(/\s/g, ',')}`
}
