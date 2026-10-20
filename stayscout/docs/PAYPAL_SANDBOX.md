# PayPal sandbox setup and test script

StayScout's PayPal integration (`server/providers/payments.ts`) follows the Orders v2 API: the server creates the order and captures it; the browser only relays PayPal's order id. It has been tested against recorded response shapes but **not yet against PayPal's sandbox**. This checklist is how to do that.

## 1. Credentials (free, no billing)

1. Sign in at https://developer.paypal.com → **Apps & Credentials** → make sure **Sandbox** is selected.
2. **Create App** (type: Merchant). Copy the **Client ID** and **Secret**.
3. Under **Testing tools → Sandbox accounts**, note the default **Personal** (buyer) account's email and password.

## 2. Configure

```bash
PAYMENTS_PROVIDER=paypal
PAYPAL_ENV=sandbox
PAYPAL_CLIENT_ID=<sandbox client id>
PAYPAL_CLIENT_SECRET=<sandbox secret>
GUIDE_PRICE=9.00
GUIDE_CURRENCY=USD
```

Put these in `.env` (git-ignored) or your host's secret store. Never commit them.

## 3. Test script

Run each case on a fresh trip that has a generated plan.

| #   | Do                                                                                                   | Expect                                                                                                                    |
| --- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 0   | Try to pay without ticking the immediate-access box                                                  | PayPal buttons are hidden until it is ticked                                                                              |
| 1   | Open the trip's plan page                                                                            | "Unlock every day…" panel with PayPal buttons; only Day 1 visible; PDF link absent; `GET /api/trips/<id>/guide.pdf` → 402 |
| 2   | Click PayPal, then close the popup                                                                   | "Checkout cancelled. You have not been charged." Still locked                                                             |
| 3   | Pay with the sandbox buyer account                                                                   | "Payment confirmed…"; all days visible; PDF downloads; share link available                                               |
| 4   | Check the database: `select status, capture_id from orders where trip_id = '<id>'`                   | One row, `paid`, with a capture id                                                                                        |
| 5   | In the PayPal sandbox dashboard, find the transaction                                                | Amount 9.00 USD; custom ID = trip id                                                                                      |
| 6   | Re-send the capture: `POST /api/trips/<id>/checkout/capture {"orderId":"<id>"}` with the same cookie | `{"status":"paid"}`; no second capture in PayPal                                                                          |
| 7   | Try `POST /api/trips/<id>/checkout` again                                                            | 409 "already unlocked"                                                                                                    |
| 8   | Use PayPal's sandbox negative testing to force a declined capture                                    | "The payment did not go through." Still locked                                                                            |

Amount, currency and guide-id mismatches are hard to provoke from the sandbox UI; they are covered by the automated tests in `tests/payments-flow.test.ts` and `tests/providers.test.ts`.

If any step differs, check the server log (it records the provider name and HTTP status, never secrets or payloads).

## 4. Webhooks (recommended before live)

1. In the sandbox app, open **Webhooks → Add webhook**. URL: `https://<your-domain>/api/webhooks/paypal`. Events: `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.REFUNDED`, `PAYMENT.CAPTURE.REVERSED`.
2. Copy the **Webhook ID** into `PAYPAL_WEBHOOK_ID`.
3. Test it: refund the sandbox payment from row 3 in the PayPal dashboard. Within a minute, reloading the trip should show the preview again (the guide is re-locked).
4. Don't use PayPal's webhook simulator for this check. Simulator events are mock events and may not pass signature verification, so StayScout answering them with HTTP 400 is expected. A real sandbox refund (step 3) is the reliable end-to-end test.

Every event is checked with PayPal (`/v1/notifications/verify-webhook-signature`), and the order is then re-fetched before anything changes. Without webhooks, pending captures are still re-checked when the buyer revisits the trip.

## 5. Going live

Only after every row above passes in sandbox:

1. Create **Live** app credentials in the PayPal dashboard (requires a verified business account).
2. Set `PAYPAL_ENV=live`, the live credentials, **and** `PAYPAL_LIVE_ENABLED=true`. The server refuses to start in live mode without that flag.
3. Make one real purchase, then refund it from the PayPal dashboard. Confirm the order moves to `refunded` and the guide re-locks.
4. Publish a refund policy on the Terms page.
