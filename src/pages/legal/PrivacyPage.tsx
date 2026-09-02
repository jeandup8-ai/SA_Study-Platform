import { LegalPageLayout } from './LegalPageLayout'

export function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated="2 September 2026">
      <p>
        This policy explains what personal information StudyLegends collects, why, and what actually
        happens to it in this product today. It is written to describe the platform's real,
        current behaviour — not aspirational or planned behaviour — and has been prepared with
        South Africa's Protection of Personal Information Act (POPIA) in mind. <strong>It has not
        yet been reviewed by a qualified attorney and must not be relied on as a compliance
        certification.</strong> Legal review is required before this policy is published for real
        users.
      </p>

      <h2>Who this applies to</h2>
      <p>
        StudyLegends is a parent-owned account. A parent or guardian ("Parent") creates the account and
        adds one or more child learner profiles ("Learner"). <strong>Learners never have their own
        login credentials</strong> — a Learner's profile is only ever accessed through their
        Parent's signed-in session, switched locally like a "which child is using this device"
        selector. This is a deliberate design choice to minimise data collected from children and
        remove any child-facing account-security surface entirely.
      </p>

      <h2>What we collect</h2>
      <p>For a Parent account, we store:</p>
      <ul>
        <li>Full name</li>
        <li>Email address</li>
        <li>Phone number</li>
        <li>Preferred language</li>
      </ul>
      <p>For each Learner profile, we store:</p>
      <ul>
        <li>Display name (chosen by the Parent — not required to be the child's legal name)</li>
        <li>A cartoon avatar selected from a fixed set of built-in icons — never an uploaded photo</li>
        <li>Curriculum and grade</li>
        <li>Preferred language</li>
        <li>Birth year only (a single year, not a full date of birth)</li>
      </ul>
      <p>
        <strong>We do not collect a physical address from any user, for any account, at any
        point.</strong> Learning activity (lessons viewed, quiz answers, mastery scores) is stored
        against the Learner profile so progress and the parent dashboard work.
      </p>

      <h2>"Scan My Work" photo and PDF uploads</h2>
      <p>
        When a Learner uploads a photo or PDF of their work, the file is sent to a server-side
        safety check before anything else happens to it. As of this policy's last-updated date:
      </p>
      <ul>
        <li>
          <strong>The file itself is not stored.</strong> There is no file-storage bucket
          configured in this product's backend — the upload exists only for the moment it takes to
          run the safety check and is not retained afterwards.
        </li>
        <li>
          The file's type and size are validated on our server, independently of the app.
        </li>
        <li>
          Photos are checked for embedded GPS location data. If a photo's metadata reveals a
          location, it is automatically rejected before anything else happens with it.
        </li>
        <li>
          Photos may also be sent to a third-party image-safety provider (Sightengine) to screen
          for unsafe content (e.g. nudity, weapons, gore). <strong>Whether this third-party check
          is currently active on the live product has not been confirmed</strong> — it depends on
          server-side credentials this review could not inspect. When the check does run, the
          image is shared with Sightengine only for that single scan; only the resulting
          decision (approved/rejected) and machine-readable reason codes are stored, never the
          image, and never a confidence score.
        </li>
        <li>
          We do not run any text/PII detection on uploaded images (for example, to catch a visible
          ID number, address, or phone number in the photo). This is a known gap, not a feature.
        </li>
      </ul>

      <h2>What we do not do</h2>
      <ul>
        <li>
          <strong>No advertising or analytics tracking.</strong> This product has no analytics,
          advertising, or tracking scripts of any kind integrated.
        </li>
        <li>
          <strong>Limited, narrow AI/LLM use.</strong> "Explain again" and "make it easier" work by
          showing a second, pre-written version of a lesson — no AI provider is involved. Separately,
          "explain a different way" sends a third-party AI language model (Anthropic's Claude) only
          the current topic's curriculum content (topic name, learning objectives, subject
          terminology), the Learner's grade and language preference, and — if relevant — the text of
          a recent practice question they answered incorrectly. No name, email address, or other
          identifying information is ever included in that request. This feature does not accept
          free-text input from a Learner and cannot be used to ask about anything outside the
          current lesson topic.
        </li>
        <li>
          <strong>No marketing emails.</strong> No marketing or promotional emails are sent by this
          product. A transactional email provider (Resend) is integrated solely to deliver
          account-related emails — sign-up confirmation, password reset — triggered by actions you
          take; see "Account emails" below.
        </li>
        <li>
          <strong>No sale of personal information</strong> to any third party, ever.
        </li>
        <li>
          <strong>No child-to-child communication, public profiles, comments, or social features
          of any kind exist anywhere in this product.</strong> A Learner cannot see, message, or
          be seen by any other Learner.
        </li>
      </ul>

      <h2>Account emails</h2>
      <p>
        New sign-ups must confirm their email address via a link before signing in. That
        confirmation email, and any future password-reset email, is sent through Resend, our
        transactional email provider — no marketing, promotional, or unsolicited email is ever
        sent through this channel.
      </p>

      <h2>Where your data is stored</h2>
      <p>
        Data is stored in a dedicated Supabase (PostgreSQL) project used only by this product —
        it is not shared with any other application. Every table holding personal or learning
        data has row-level security enabled, so a Parent's account can only ever read or write
        rows belonging to their own Learners, enforced by the database itself rather than by the
        app trusting itself to ask correctly.
      </p>

      <h2>Payments</h2>
      <p>
        No payment provider is connected to this product yet. Starting a subscription today
        records your intent to subscribe only — it does not charge a card, and no card or banking
        details are collected or stored anywhere in this product at this time. This section will
        be updated with the relevant payment processor's data-handling details before real billing
        goes live.
      </p>

      <h2>Your rights</h2>
      <p>
        Under POPIA, you have the right to request access to, correction of, or deletion of your
        (or your child's) personal information, and to object to certain processing. To make a
        request, contact us using the details on our <a href="/contact">Contact page</a>.
        A minimum-viable, human-actioned process for these requests exists via that inbox; a
        self-service data-export or delete-my-account tool does not yet exist in the app itself.
      </p>
      <p>
        We have not yet defined a formal data-retention schedule (e.g. how long an inactive
        account's data is kept). This is a known gap to close before this policy is finalised.
      </p>

      <h2>Children's information</h2>
      <p>
        StudyLegends is built for use by children under a Parent's supervision, and every Learner profile
        is created and controlled by a Parent, not by the child directly. We rely on Parents to
        provide consent for their child's use of the product, consistent with POPIA's approach to
        processing a child's personal information with the consent of a competent person
        (typically a parent or guardian).
      </p>

      <h2>Changes to this policy</h2>
      <p>
        We will update the "Last updated" date above whenever this policy changes, and will
        highlight material changes on this page.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this policy or a data request should go to the details on our{' '}
        <a href="/contact">Contact page</a>.
      </p>
    </LegalPageLayout>
  )
}
