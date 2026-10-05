# PayFast sandbox test — step by step

Purpose: prove the **Family (Annual) R3,349** payment works end to end, and
that paying actually unlocks the app.

The monthly path is already proven (four sandbox ITNs, 2026-09-11). Two
things have never run: `frequency=6`, and the ITN's amount check against
`334900`. This exercises both.

Allow about 30 minutes. Nothing here is irreversible.

---

## Before you start — three things that will ruin the test

**1. Do NOT use `jeandup8@gmail.com`.**
That account is an **admin**, and admins bypass the entitlement gate
unconditionally. You would see the app unlock whether or not payment
worked, which proves nothing. Use a non-admin account — see Step 1.

**2. Use the sandbox passphrase, not the live one.**
The passphrase signs the outgoing form *and* verifies the incoming
notification. Your sandbox passphrase is different from live. Get this
wrong and PayFast takes the payment while StudyLegends rejects the
notification — which looks identical to a broken integration.

**3. You are switching the live site into sandbox for the duration.**
These settings are project-wide. While you test, a real customer reaching
checkout would hit sandbox. Do it in a quiet hour and finish Step 6.

---

## Step 1 — Pick the account you'll test with

**Best option: sign up a brand-new parent.** It tests the whole funnel, and
a fresh account has no history to confuse the result.

Alternatively use `jeandup8+test1@gmail.com` — not an admin, no
subscriptions, one learner already. Only if you know its password.

Either way, **not** `jeandup8@gmail.com`.

---

## Step 2 — Get your PayFast sandbox credentials

The sandbox is a **completely separate system** from `my.payfast.io`. There
is no link between them and no menu item for it. Looking for one in the
live dashboard is why this step gets stuck.

1. Open a new tab: **https://sandbox.payfast.co.za**
2. Sign in with the **same email address as your live PayFast account**.
3. Once in, go to **Settings → Integration**.
4. Write down three values:
   - **Merchant ID** (your September test used `10054207`)
   - **Merchant Key**
   - **Passphrase** — if the passphrase field is blank, set one now and
     save it. A blank passphrase works, but then Supabase must also have it
     blank, and it is easier to set one than to keep them both empty.

**If you cannot sign in**, PayFast publishes shared test credentials. These
are public test values, not secrets:

| Merchant ID | Merchant Key | Passphrase |
|---|---|---|
| `10000100` | `46f0cd694581a` | `jt7NOE43FZPn` |
| `10004002` | `q1cd2rdny4a53` | `payfast` |

Prefer your own — the shared sandbox has everyone else's transactions in it.

---

## Step 3 — Put those credentials into Supabase

1. Open **https://supabase.com/dashboard/project/dzphkuzhdpzawhucmjzh/settings/functions**

   If that URL does not open the right page, navigate manually:
   Supabase Dashboard → your project → **Project Settings** (gear, bottom
   left) → **Edge Functions** → **Secrets**.

   You need the **Owner** or **Administrator** role to change secrets.

2. Add or edit these **five** secrets. Click **Add new secret**, enter the
   Key and Value, then **Save**. (You can paste several at once.)

| Key | Value |
|---|---|
| `PAYFAST_MODE` | `sandbox` |
| `PAYFAST_MERCHANT_ID` | your sandbox Merchant ID from Step 2 |
| `PAYFAST_MERCHANT_KEY` | your sandbox Merchant Key from Step 2 |
| `PAYFAST_PASSPHRASE` | your sandbox Passphrase from Step 2 |
| `APP_BASE_URL` | `https://studylegends.co.za` |

3. **Write down the current live values first** if any already exist — you
   will put them back in Step 6.

**Do not create** `SUPABASE_URL`, `SUPABASE_ANON_KEY` or
`SUPABASE_SERVICE_ROLE_KEY`. Supabase injects those automatically, and the
dashboard rejects names starting with `SUPABASE_`.

**You do not set a notify URL anywhere.** The code builds it itself:
`https://dzphkuzhdpzawhucmjzh.supabase.co/functions/v1/payfast-itn`

Secrets apply within a few seconds; the functions do not need redeploying.

---

## Step 4 — Make the payment

1. Open StudyLegends and **sign in as the account from Step 1**.
2. If it is a new account, create one learner when prompted.
3. Go to **/parent/subscription**.
4. Find the **Family (Annual)** card — it should read **R3,349.00** and
   "Up to 4 child profiles".
5. Click **Subscribe with PayFast**.
6. You land on the PayFast sandbox.

### There is no test card

The sandbox does not process cards at all. Every payment method is replaced
by a **virtual wallet** holding R99,999,999.99, reset nightly.

Click **"Pay Now Using Your Wallet"**. R3,349 will go through regardless of
balance.

7. You should return to `/parent/subscription?payment=success`.

That green banner only means you came back from PayFast. It is **not**
proof of payment. Step 5 is.

---

## Step 5 — Check the payment was recorded

1. Open **https://supabase.com/dashboard/project/dzphkuzhdpzawhucmjzh/sql/new**

   Or: Supabase Dashboard → your project → **SQL Editor** (left sidebar) →
   **New query**.

2. Paste this and click **Run**:

```sql
select
  e.created_at,
  e.amount_gross,
  e.signature_valid,
  e.server_validated,
  e.processed_at is not null              as processed,
  e.raw_payload->>'merchant_id'           as merchant_id,
  s.status                                as subscription_status,
  s.provider_subscription_id is not null  as token_stored,
  (s.current_period_end::date - current_date) as days_granted,
  p.name, p.price_cents/100 as plan_rand, p.max_learners as seats
from payment_events e
join subscriptions s           on s.id = e.subscription_id
left join subscription_plans p on p.id = s.plan_id
order by e.created_at desc
limit 1;
```

3. Compare against this. **Every row must match.**

| Column | Must be |
|---|---|
| `amount_gross` | **3349.00** |
| `signature_valid` | **true** |
| `server_validated` | **true** |
| `processed` | **true** |
| `merchant_id` | your sandbox ID |
| `subscription_status` | **active** |
| `token_stored` | **true** |
| `days_granted` | **≈365** |
| `name` | Family (Annual) |
| `plan_rand` | 3349 |
| `seats` | 4 |

### If something is wrong

| What you see | What it means | Fix |
|---|---|---|
| No rows at all | PayFast never reached the function | Check the logs — Dashboard → **Edge Functions** → `payfast-itn` → **Logs** |
| `signature_valid` false | Passphrase mismatch | The Supabase passphrase is not the sandbox one. Redo Steps 2–3 |
| `signature_valid` true, `server_validated` false | Mode mismatch | `PAYFAST_MODE` disagrees with the account you paid on |
| `processed` true but status not `active` | Amount or merchant mismatch | Check `amount_gross` is exactly 3349.00 and `merchant_id` matches |

---

## Step 6 — Check the app actually unlocked

This is the half the September test could not cover — the entitlement gate
did not exist then.

Still signed in as the test parent, in the browser:

1. Go to **/app**.
2. You should see the **learner dashboard**, not the screen saying *"Your
   access has not started yet"*.
3. Open any subject → topic → **lesson**, and confirm the lesson content
   loads.

Step 3 is the real proof. Lesson content is gated by row-level security, so
content appearing means the database granted access — not the browser.

Optional, in the SQL editor:

```sql
-- Seats this parent is entitled to. Expect 4.
select sp.max_learners
from subscriptions s
join subscription_plans sp on sp.id = s.plan_id
where s.parent_id = (select id from parents where email = 'PUT_TEST_EMAIL_HERE')
  and (s.status = 'active'
    or (s.status = 'trialing' and s.trial_ends_at    > now())
    or (s.status = 'canceled' and s.current_period_end > now()))
order by sp.max_learners desc
limit 1;
```

---

## Step 7 — Put live settings back

**Do not skip this.** The site is in sandbox mode until you do.

Return to the secrets page from Step 3 and set:

| Key | Value |
|---|---|
| `PAYFAST_MODE` | `live` |
| `PAYFAST_MERCHANT_ID` | your **live** Merchant ID (`36763375`) |
| `PAYFAST_MERCHANT_KEY` | your **live** Merchant Key |
| `PAYFAST_PASSPHRASE` | your **live** Passphrase |

Leave `APP_BASE_URL` as is.

Then tidy up:
- **Leave the `payment_events` row.** It is the evidence this test produced.
- The sandbox subscription is a real `active` row granting real access on a
  test account. Leave it, or cancel it from `/parent/subscription`.

---

## What this proves, and what it does not

**Proves:** the annual amount reaches PayFast correctly, `frequency=6` is
accepted, the ITN's amount check passes against R3,349, the subscription
activates, the recurring token is stored, and paid access unlocks the app.

**Does not prove:** that the renewal charge fires in a year. No sandbox can
show that. What you can confirm is that `token_stored` is true — without
that token there is nothing for PayFast to bill against; with it, the
renewal is their job.

**Worth doing once afterwards:** cancel the sandbox subscription and check
that access survives until the period end rather than cutting off
immediately. That rule is verified at the database level already, but it is
cheap to see for yourself.
