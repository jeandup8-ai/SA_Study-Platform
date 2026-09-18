/**
 * Length of the free trial, in days.
 *
 * Single source of truth on purpose: this value is both granted by
 * `SubscriptionPage.startTrial` and advertised on the public site. When the
 * two drift, the site promises a trial the product does not give.
 */
export const TRIAL_DAYS = 3
