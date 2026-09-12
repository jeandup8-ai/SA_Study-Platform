import { LegalPageLayout } from './LegalPageLayout'

export function ContactPage() {
  return (
    <LegalPageLayout title="Contact" lastUpdated="12 September 2026">
      <p>
        <strong>Honest status: the registered business address below is still a placeholder and
        must be replaced with real, checked details before this page is published.</strong> Every
        other field on this page is now a real, working contact method.
      </p>

      <h2>General support</h2>
      <p>Email: info@legendsupplies.co.za</p>

      <h2>Privacy and data requests</h2>
      <p>
        For a request relating to your (or your child's) personal information under our{' '}
        <a href="/privacy">Privacy Policy</a>, email: info@legendsupplies.co.za.
      </p>

      <h2>Billing, refunds, and cancellation</h2>
      <p>
        For a billing, refund, or cancellation request, email: info@legendsupplies.co.za. See
        also our <a href="/refund-policy">Refund Policy</a> and{' '}
        <a href="/subscription-cancellation">Subscription Cancellation</a> pages.
      </p>

      <h2>Registered business address</h2>
      <p>[REGISTERED BUSINESS ADDRESS — TO BE CONFIRMED]</p>

      <h2>Note on how this is handled today</h2>
      <p>
        No automated email-sending is currently integrated into this product, so any contact
        method listed here (once filled in) needs to be a real inbox someone actually checks — a
        form on this page could not currently deliver a message anywhere, so this page lists
        direct contact details rather than a submission form.
      </p>
    </LegalPageLayout>
  )
}
