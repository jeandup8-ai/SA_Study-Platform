import { LegalPageLayout } from './LegalPageLayout'

export function TermsPage() {
  return (
    <LegalPageLayout title="Terms of Service" lastUpdated="30 August 2026">
      <p>
        These terms govern use of Study, a mobile-first learning app for South African learners in
        Grade 4–7, built around the CAPS curriculum. <strong>These terms have not yet been
        reviewed by a qualified attorney</strong> and are provided as a working draft to be
        checked before this product is opened to real, paying users. Placeholders below marked in
        brackets must be filled in with real, verified information before publication — nothing in
        brackets is a real company detail.
      </p>

      <h2>1. The company</h2>
      <p>
        Study is operated by [LEGAL ENTITY NAME — TO BE CONFIRMED], registration number
        [COMPANY REGISTRATION NUMBER — TO BE CONFIRMED], of [REGISTERED BUSINESS ADDRESS — TO BE
        CONFIRMED] ("we," "us," "Study"). These details must be completed with the real,
        registered business information before this page is published.
      </p>

      <h2>2. Accounts</h2>
      <p>
        Only a parent or legal guardian ("Parent") may create an account. A Parent may add one or
        more child learner profiles ("Learner") under their account. Learners do not have their
        own login credentials and cannot create or manage an account independently. By creating an
        account you confirm you are the Learner's parent or legal guardian, or otherwise have the
        legal authority to consent on the Learner's behalf.
      </p>

      <h2>3. The service</h2>
      <p>
        Study provides lesson content, practice questions, and progress tracking structured around
        the South African CAPS curriculum for Grades 4–7. <strong>Lesson content is generated with
        AI assistance from the official CAPS curriculum documents, but has not yet been reviewed by
        a qualified teacher or curriculum specialist.</strong> Each lesson generated this way is
        clearly marked as AI-assisted and pending review inside the app itself. Do not treat any
        content in this product as verified, exam-accurate curriculum material until it has been
        reviewed and marked as such.
      </p>
      <p>
        Features described as "AI tutor" actions (such as "explain again" or "make it easier")
        currently work by showing a second, pre-written version of a lesson. There is no
        general-purpose AI chatbot or third-party AI language model in this product today.
      </p>

      <h2>4. Subscriptions, trial, and billing</h2>
      <p>
        Study is offered on a single Family Plan at R129 per month or R1,099 per year, each
        starting with a 3-day free trial. You can use the plan during the trial at no charge;
        after the trial ends, the subscription is intended to renew automatically at the listed
        price until cancelled, unless you cancel before the trial ends.
      </p>
      <p>
        <strong>At the time of writing, no live payment processor is connected to this product.</strong>
        Starting a plan currently records your intent to subscribe only — it does not charge a
        card, because no card details are currently collected anywhere in the product. This
        section describes the billing terms that will apply once a South African payment provider
        (for example PayFast) is connected and switched on; it will be updated to name that
        provider before real billing goes live. See our <a href="/refund-policy">Refund Policy</a>
        {' '}and <a href="/subscription-cancellation">Cancellation</a> pages for what happens after
        that point.
      </p>

      <h2>5. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the service for any purpose other than a Learner's own study;</li>
        <li>Attempt to circumvent the content-moderation checks on uploaded files;</li>
        <li>Upload any content you do not have the right to upload;</li>
        <li>Attempt to access another Parent's or Learner's account or data.</li>
      </ul>

      <h2>6. Content moderation on uploads</h2>
      <p>
        Any photo or PDF uploaded through "Scan My Work" is checked on our server before it is
        shown back in the app. This includes file-type and size checks, a check for embedded GPS
        location data in photos (rejected automatically if found), and — when configured — a
        third-party visual-safety scan for unsafe imagery. Uploaded files are not stored after this
        check runs. See our <a href="/privacy">Privacy Policy</a> for full detail.
      </p>

      <h2>7. No guarantee of results</h2>
      <p>
        Study is a study aid, not a substitute for a qualified teacher or an official assessment.
        We do not guarantee any particular exam result, grade, or curriculum outcome from using
        this product.
      </p>

      <h2>8. Cancellation</h2>
      <p>
        You may cancel at any time as described on our{' '}
        <a href="/subscription-cancellation">Subscription Cancellation</a> page. Self-service
        cancellation inside the app is not yet built; cancellation currently has to be requested
        through <a href="/contact">Contact</a>.
      </p>

      <h2>9. Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, Study is provided "as is" without warranties of
        any kind, and we are not liable for indirect or consequential loss arising from your use
        of the product. Nothing in these terms limits liability that cannot lawfully be excluded
        under South African law.
      </p>

      <h2>10. Governing law</h2>
      <p>These terms are governed by the laws of the Republic of South Africa.</p>

      <h2>11. Changes to these terms</h2>
      <p>
        We may update these terms from time to time. We will update the "Last updated" date above
        when we do.
      </p>

      <h2>12. Contact</h2>
      <p>
        Questions about these terms should go to the details on our{' '}
        <a href="/contact">Contact page</a>.
      </p>
    </LegalPageLayout>
  )
}
