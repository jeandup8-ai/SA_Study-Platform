import { LegalPageLayout } from './LegalPageLayout'

export function SubscriptionCancellationPage() {
  return (
    <LegalPageLayout title="Subscription Cancellation" lastUpdated="22 August 2026">
      <p>
        <strong>Honest status: there is currently no self-service "Cancel subscription" button
        anywhere in the app.</strong> This is a real gap, not an oversight in this page — it is
        listed here so it is fixed before real billing goes live rather than discovered by a
        parent who needs it.
      </p>

      <h2>How to cancel today</h2>
      <p>
        Because no payment provider is connected yet, no subscription started in the app today is
        actually being billed — starting a plan only records your intent to subscribe. If you
        would still like your account's subscription record removed or your trial stopped, contact
        us using the details on our <a href="/contact">Contact page</a> and we will action it
        manually.
      </p>

      <h2>Once billing is live</h2>
      <p>
        Before real billing goes live, we intend to add a self-service cancellation option inside
        the app (on the Manage Subscription screen), so cancelling does not require contacting
        support. Until that exists, cancellation will continue to be handled manually through{' '}
        <a href="/contact">Contact</a>. Cancelling stops the next billing charge; it does not
        automatically refund a charge already made — see our{' '}
        <a href="/refund-policy">Refund Policy</a> for that.
      </p>
    </LegalPageLayout>
  )
}
