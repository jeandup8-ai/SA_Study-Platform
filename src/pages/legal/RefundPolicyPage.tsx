import { LegalPageLayout } from './LegalPageLayout'

export function RefundPolicyPage() {
  return (
    <LegalPageLayout title="Refund Policy" lastUpdated="22 August 2026">
      <p>
        <strong>No payment provider is connected to Study yet, so no real payments are being taken
        today and there is currently nothing to refund.</strong> This page describes the refund
        policy we intend to apply once real billing (via a South African payment provider such as
        PayFast) goes live. It has not yet been reviewed by a qualified attorney and should be
        checked against that provider's own requirements before publication.
      </p>

      <h2>Free trial</h2>
      <p>
        Every Family Plan subscription starts with a 3-day free trial. If you cancel before the
        trial ends, you will not be charged. This is true today in the sense that starting a trial
        in the app only records your intent to subscribe — it does not charge a card, because no
        card-collection or billing step exists in the product yet.
      </p>

      <h2>Once billing is live</h2>
      <p>Once a real payment provider is connected, we intend to offer:</p>
      <ul>
        <li>
          A full refund if you are charged in error (for example, a duplicate charge or a charge
          after you had already cancelled).
        </li>
        <li>
          A refund of your most recent monthly or annual charge if requested within 7 days of that
          charge, no questions asked.
        </li>
        <li>
          No partial refunds for the unused portion of a billing period requested outside that
          7-day window, other than at our discretion.
        </li>
      </ul>
      <p>
        These terms are our current intended policy, not a legal guarantee, and will be finalised
        alongside the payment provider integration and reviewed by an attorney before real billing
        goes live.
      </p>

      <h2>How to request a refund</h2>
      <p>
        There is no self-service refund button in the app today. Once billing is live, refund
        requests will go through the same channel as cancellation requests — see our{' '}
        <a href="/subscription-cancellation">Subscription Cancellation</a> page and our{' '}
        <a href="/contact">Contact page</a>.
      </p>
    </LegalPageLayout>
  )
}
