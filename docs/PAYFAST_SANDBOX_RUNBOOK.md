# Running a PayFast sandbox checkout

For verifying the **Family (Annual) R3,349** path, which has never executed.
The monthly path is already proven — four sandbox ITNs on 2026-09-11, all
signature-valid, server-validated and processed.

Two things in the annual path have never run: `frequency=6`, and the ITN's
amount check against `334900`. This exercises both.

---

## Before you start

Two warnings, because both will silently waste a transaction.

**The passphrase must be the sandbox one.** `PAYFAST_PASSPHRASE` is used to
build the signature on the way out *and* to verify the ITN on the way back.
Your sandbox account has its own passphrase, separate from live. Leave the
live passphrase in place while `PAYFAST_MODE=sandbox` and every signature
fails — the payment will go through at PayFast and the ITN will be rejected
by your own handler, which looks exactly like a broken integration.

**You are switching the live site into sandbox mode.** These are
project-wide Edge Function secrets, so while you test, a real customer
reaching checkout would hit sandbox. Do this in a quiet window, and switch
back (step 6) the moment you are done.

---

## 1. Set the Edge Function secrets

Supabase Dashboard → **Project Settings → Edge Functions → Secrets**, or
from a terminal with the CLI linked to the project:

```
supabase secrets set \
  PAYFAST_MODE=sandbox \
  PAYFAST_MERCHANT_ID=<your sandbox merchant id> \
  PAYFAST_MERCHANT_KEY=<your sandbox merchant key> \
  PAYFAST_PASSPHRASE=<your sandbox passphrase> \
  APP_BASE_URL=https://studylegends.co.za
```

All five are read by the functions:

| Secret | Used by | Notes |
|---|---|---|
| `PAYFAST_MODE` | checkout, ITN | `sandbox` or `live`. Chooses both the process URL and the validate URL. Defaults to `sandbox` if unset. |
| `PAYFAST_MERCHANT_ID` | checkout, ITN | The ITN rejects any notification whose `merchant_id` does not match this. |
| `PAYFAST_MERCHANT_KEY` | checkout | Sent in the checkout form. Never reaches the browser — the function builds the form server-side. |
| `PAYFAST_PASSPHRASE` | checkout, ITN | Signature on both legs. See the warning above. |
| `APP_BASE_URL` | checkout | Return and cancel URLs. **Set it explicitly** — it defaults to `https://www.studylegends.co.za` (www), while your canonical domain is the apex. Leaving the default splits sessions across hosts. |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are
injected automatically. Do not set them by hand.

You do **not** configure `notify_url` anywhere. The checkout function builds
it from `SUPABASE_URL`:

```
https://dzphkuzhdpzawhucmjzh.supabase.co/functions/v1/payfast-itn
```

`payfast-itn` is deployed with `verify_jwt = false`, so PayFast can POST to
it without a token. That is correct and intentional — the signature and
PayFast's own validation endpoint are what authenticate it, not a JWT.

## 2. Your sandbox account

Log in at **sandbox.payfast.co.za** with your sandbox merchant account —
the one whose merchant id is `10054207`, which is what your September test
used. Confirm the passphrase under *Settings → Integration* matches what
you just put in Supabase.

PayFast's sandbox does not take a real card; it presents a simulated
payment you confirm. Their current test-payment details are on
**developers.payfast.co.za** — check there rather than reusing a card
number from memory, as they change it.

## 3. Run the checkout

1. Sign in to StudyLegends as a parent.
2. Go to **/parent/subscription**.
3. Press **Subscribe with PayFast** on the **Family (Annual)** card — R3,349.
4. Complete the simulated payment in the sandbox.
5. You should land back on `/parent/subscription?payment=success`.

That banner is informational only. It proves you came back from PayFast,
not that you paid. The next step is what actually proves it.

## 4. Verify the ITN landed

Run this in the Supabase SQL editor:

```sql
select
  e.created_at,
  e.amount_gross,
  e.signature_valid,
  e.server_validated,
  e.processed_at is not null              as processed,
  e.raw_payload->>'merchant_id'           as merchant_id,
  e.raw_payload ? 'token'                 as recurring_token_returned,
  s.status                                as subscription_status,
  s.provider_subscription_id is not null  as token_stored,
  s.current_period_end,
  (s.current_period_end::date - current_date) as days_granted,
  p.name, p.price_cents/100 as plan_rand, p.max_learners
from payment_events e
join subscriptions s        on s.id = e.subscription_id
left join subscription_plans p on p.id = s.plan_id
order by e.created_at desc
limit 1;
```

**What a pass looks like:**

| Field | Expected |
|---|---|
| `amount_gross` | **3349.00** |
| `signature_valid` | `true` |
| `server_validated` | `true` |
| `processed` | `true` |
| `merchant_id` | your sandbox id |
| `recurring_token_returned` | `true` |
| `subscription_status` | **`active`** |
| `token_stored` | `true` |
| `days_granted` | **≈365** |
| `name` / `plan_rand` | Family (Annual) / 3349 |
| `max_learners` | 4 |

If `signature_valid` is `false`, the passphrase is wrong — see the warning
at the top. If `signature_valid` is `true` but `server_validated` is
`false`, `PAYFAST_MODE` disagrees with the account you paid on (sandbox
payment validated against the live endpoint, or vice versa).

If no row appears at all, PayFast never reached the function. Check the
`payfast-itn` logs under Edge Functions.

## 5. Verify entitlement actually unlocked

This is the half the September test could not cover, because the gate did
not exist then.

```sql
-- As the parent who just paid. Expect true.
select public.has_paid_access();

-- Seats: expect 4 for Family.
select sp.max_learners
from subscriptions s join subscription_plans sp on sp.id = s.plan_id
where s.parent_id = auth.uid()
  and (s.status='active'
    or (s.status='trialing'  and s.trial_ends_at    > now())
    or (s.status='canceled'  and s.current_period_end > now()))
order by sp.max_learners desc limit 1;
```

Then in the browser: open **/app**. You should get the learner dashboard,
not the "Your access has not started yet" screen. Open a lesson and confirm
the content loads — that is RLS returning rows, which is the real proof.

## 6. Switch back to live

```
supabase secrets set \
  PAYFAST_MODE=live \
  PAYFAST_MERCHANT_ID=<live merchant id> \
  PAYFAST_MERCHANT_KEY=<live merchant key> \
  PAYFAST_PASSPHRASE=<live passphrase>
```

Then decide what to do with the sandbox subscription you created. It is a
real `active` row granting real access. Either leave it (harmless on your
own account) or cancel it from **/parent/subscription**. Do not delete the
`payment_events` row — it is the evidence this test produced.

---

## What this does and does not prove

**Proves:** the annual amount reaches PayFast correctly, `frequency=6` is
accepted, the ITN's amount check passes against `334900`, the subscription
activates with a recurring token, and paid access unlocks the app.

**Does not prove:** that the *recurring* charge fires in a year. No sandbox
can show you that in real time. What you can check is that
`provider_subscription_id` (the PayFast token) was stored — without it
there is nothing to bill against, and with it the renewal is PayFast's job.

**Also worth doing once, separately:** cancel the sandbox subscription and
confirm access survives until `current_period_end` rather than cutting off
immediately. That rule is already verified at the database level, but it is
cheap to see end to end.
