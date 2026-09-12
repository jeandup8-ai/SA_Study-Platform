import { LegalPageLayout } from './LegalPageLayout'

export function RefundPolicyPage() {
  return (
    <LegalPageLayout title="Refund Policy" lastUpdated="13 September 2026">
      <p>
        Billing is handled by PayFast, a South African payment provider. This page describes our
        refund policy. <strong>It has not yet been reviewed by a qualified attorney</strong> and
        should be checked against PayFast's own requirements.
      </p>

      <h2>Free trial</h2>
      <p>
        Every Family Plan subscription starts with a 3-day free trial. Starting a trial directly
        does not charge a card and does not go through PayFast at all — it simply activates trial
        access on your account. Only choosing to subscribe with PayFast takes you to their
        checkout to enter card details.
      </p>

      <h2>Refunds</h2>
      <p>We offer:</p>
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
        These terms are our current policy, not a legal guarantee, and may be updated once
        reviewed by an attorney.
      </p>

      <h2>How to request a refund</h2>
      <p>
        There is no self-service refund button in the app today. Refund requests go through the
        same channel as cancellation requests — see our{' '}
        <a href="/subscription-cancellation">Subscription Cancellation</a> page and our{' '}
        <a href="/contact">Contact page</a>.
      </p>
    </LegalPageLayout>
  )
}
