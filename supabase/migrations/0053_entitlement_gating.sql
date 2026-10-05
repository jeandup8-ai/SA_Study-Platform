-- Make paid access actually mean something.
--
-- THE DEFECT. Payment worked end to end -- checkout signs a recurring
-- PayFast subscription, the ITN verifies signature, PayFast's own
-- validation endpoint, merchant id and the amount against the plan price,
-- and writes status='active'. Nothing then read that status. Every
-- teaching-content table was `using (true)`, so the entire curriculum was
-- readable by anyone holding the public anon key, signed in or not, paid or
-- not. A parent could pay R149 a month for access that non-payers already
-- had.
--
-- This is the missing half: a server-side entitlement rule, and RLS that
-- enforces it. Nothing about the payment flow changes.
--
-- WHERE THE FREE/PAID LINE COMES FROM. Not invented here -- it is the line
-- the product already advertises:
--
--   "Always free, no sign-up"  -> /practice (practice_tests,
--                                 practice_test_questions). Deliberately
--                                 public and crawlable. UNTOUCHED.
--   The plan checklist         -> "CAPS-aligned lessons and practice",
--                                 Scan My Work, AI explain-differently,
--                                 progress. That is the signed-in app.
--
-- So the gate goes on the four teaching-content tables and nothing else.
-- `subjects` and `topics` stay public: they are names used by the landing
-- page, the sitemap and the free practice browse, and they teach nothing on
-- their own.
--
-- WHY RESTRICTIVE POLICIES. A permissive policy ORs with the existing
-- `*_public_read` ones and would grant nothing. A RESTRICTIVE policy ANDs,
-- so the effective rule becomes `true AND has_paid_access()`. It also means
-- the existing policies are left exactly as they are -- nothing is dropped,
-- and there is no moment during deployment when a table is unprotected.

-- --------------------------------------------------------------------------
-- The one definition of "may use the paid product".
--
-- SECURITY DEFINER so it can read `subscriptions` regardless of the
-- caller's own RLS, and so the client cannot influence the answer: it takes
-- no arguments and derives everything from auth.uid(). There is no input to
-- forge. A browser can call it, but only ever about itself.
-- --------------------------------------------------------------------------
create or replace function internal.has_paid_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    internal.is_admin()
    or exists (
      select 1 from subscriptions s
      where s.parent_id = auth.uid()
        and (
          -- Paying now.
          s.status = 'active'
          -- Inside the advertised 3-day trial. Expiry is evaluated here,
          -- server-side, against the database clock -- a client cannot
          -- extend it, and the trial_ends_at column is already immutable to
          -- user sessions (0051 / protect_subscription_billing_fields).
          or (s.status = 'trialing' and s.trial_ends_at > now())
          -- Cancelled but the period they already paid for has not ended.
          -- Cutting access the moment someone cancels would be keeping
          -- their money and withdrawing the service.
          or (s.status = 'canceled' and s.current_period_end > now())
        )
    );
$$;

comment on function internal.has_paid_access() is
  'The single source of truth for paid entitlement: active subscription, live trial, or a cancelled subscription whose paid period has not yet ended. Admins always pass. Takes no arguments and reads auth.uid(), so a client cannot ask about anyone but itself. past_due (a failed renewal) deliberately does not grant access.';

-- The same answer, callable from the browser so the UI can show an
-- "activate your trial" screen instead of an empty one. It is a mirror of
-- the gate, never the gate itself -- lying to this function changes
-- nothing, because RLS re-evaluates it on every row read.
create or replace function public.has_paid_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select internal.has_paid_access();
$$;

comment on function public.has_paid_access() is
  'Browser-callable mirror of internal.has_paid_access(), for UI state only. Authorization is enforced by RLS, not by this.';

grant execute on function public.has_paid_access() to anon, authenticated;

-- --------------------------------------------------------------------------
-- Enforcement. Teaching content only.
-- --------------------------------------------------------------------------
create policy lessons_requires_entitlement on public.lessons
  as restrictive for select using (internal.has_paid_access());

create policy lesson_content_requires_entitlement on public.lesson_content
  as restrictive for select using (internal.has_paid_access());

create policy questions_requires_entitlement on public.questions
  as restrictive for select using (internal.has_paid_access());

create policy question_options_requires_entitlement on public.question_options
  as restrictive for select using (internal.has_paid_access());
