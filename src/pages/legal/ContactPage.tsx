import { LegalPageLayout } from './LegalPageLayout'

export function ContactPage() {
  return (
    <LegalPageLayout title="Contact" lastUpdated="22 August 2026">
      <p>
        <strong>Honest status: no verified support email address, phone number, or business
        registration detail currently exists anywhere in this codebase.</strong> The fields below
        are placeholders and must be replaced with real, checked details before this page is
        published — nothing in brackets is a real, working contact method today.
      </p>

      <h2>General support</h2>
      <p>Email: [SUPPORT EMAIL ADDRESS — TO BE CONFIRMED]</p>
      <p>Phone: [SUPPORT PHONE NUMBER — TO BE CONFIRMED, OPTIONAL]</p>

      <h2>Privacy and data requests</h2>
      <p>
        For a request relating to your (or your child's) personal information under our{' '}
        <a href="/privacy">Privacy Policy</a>, email: [PRIVACY/DATA-REQUEST EMAIL ADDRESS — TO BE
        CONFIRMED].
      </p>

      <h2>Billing, refunds, and cancellation</h2>
      <p>
        For a billing, refund, or cancellation request, email: [BILLING SUPPORT EMAIL ADDRESS —
        TO BE CONFIRMED]. See also our <a href="/refund-policy">Refund Policy</a> and{' '}
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
