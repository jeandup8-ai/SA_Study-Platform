// PayPal Smart Buttons. The browser only relays PayPal's order id; the server
// creates the order and decides — after its own capture — whether it is paid.

import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { ErrorNotice } from './ui'

interface PayPalButtons {
  render(el: HTMLElement): Promise<void>
  close?: () => Promise<void>
}
interface PayPalNamespace {
  Buttons(opts: {
    style?: Record<string, string>
    createOrder: () => Promise<string>
    onApprove: (data: { orderID: string }) => Promise<void>
    onCancel?: () => void
    onError?: (err: unknown) => void
  }): PayPalButtons
}
declare global {
  interface Window {
    paypal?: PayPalNamespace
  }
}

let sdkPromise: Promise<PayPalNamespace> | null = null
function loadSdk(clientId: string, currency: string): Promise<PayPalNamespace> {
  sdkPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(currency)}&intent=capture`
    s.async = true
    s.onload = () =>
      window.paypal ? resolve(window.paypal) : reject(new Error('PayPal did not load'))
    s.onerror = () => {
      sdkPromise = null
      reject(
        new Error(
          'PayPal could not be loaded. Check your connection or ad blocker and try again.',
        ),
      )
    }
    document.head.appendChild(s)
  })
  return sdkPromise
}

export function PayPalCheckout({
  tripId,
  clientId,
  price,
  onPaid,
}: {
  tripId: string
  clientId: string
  price: { amount: string; currency: string }
  onPaid: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    let buttons: PayPalButtons | null = null
    let cancelled = false
    loadSdk(clientId, price.currency)
      .then((paypal) => {
        if (cancelled || !ref.current) return
        buttons = paypal.Buttons({
          style: { layout: 'vertical', shape: 'pill', label: 'pay' },
          createOrder: async () => (await api.checkout(tripId)).orderId,
          onApprove: async ({ orderID }) => {
            setMessage('Confirming your payment with PayPal…')
            const r = await api.capture(tripId, orderID)
            if (r.status === 'paid') {
              setMessage('Payment confirmed. Your complete guide is unlocked.')
              onPaid()
            } else if (r.status === 'pending') {
              setMessage(
                'PayPal reports the payment as pending. The guide unlocks once PayPal completes it — you will not be charged twice.',
              )
            } else if (r.status === 'awaiting_approval') {
              setMessage('The payment was not approved. You have not been charged.')
            } else {
              setError(new Error(r.reason ?? 'The payment did not go through.'))
            }
          },
          onCancel: () => setMessage('Checkout cancelled. You have not been charged.'),
          onError: () =>
            setError(new Error('PayPal reported an error. You have not been charged.')),
        })
        return buttons.render(ref.current)
      })
      .catch(setError)
    return () => {
      cancelled = true
      void buttons?.close?.()
    }
  }, [tripId, clientId, price.currency, onPaid])

  return (
    <div className="space-y-3">
      <div ref={ref} />
      {message && (
        <p className="text-sm" role="status">
          {message}
        </p>
      )}
      {error ? <ErrorNotice error={error} /> : null}
    </div>
  )
}
