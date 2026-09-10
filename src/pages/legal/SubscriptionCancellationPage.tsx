import { LegalPageLayout } from './LegalPageLayout'

export function SubscriptionCancellationPage() {
  return (
    <LegalPageLayout title="Subscription Cancellation" lastUpdated="10 September 2026">
      <p>
        A "Cancel subscription" button is available on the Manage Subscription screen once you're
        signed in. Clicking it stops future billing immediately — it does not automatically refund
        a charge already made; see our <a href="/refund-policy">Refund Policy</a> for that.
      </p>

      <h2>How to cancel</h2>
      <p>
        Sign in, go to Manage Subscription, and click Cancel subscription. This records the
        cancellation on your account right away. If the automatic step with our payment provider
        doesn't go through for any reason, our records still show your cancellation was requested,
        and we reconcile it manually — you are never dependent on that one call succeeding.
      </p>

      <h2>If you have trouble</h2>
      <p>
        If you can't access the app or the button doesn't work as expected, contact us using the
        details on our <a href="/contact">Contact page</a> and we will action the cancellation
        manually.
      </p>
    </LegalPageLayout>
  )
}
