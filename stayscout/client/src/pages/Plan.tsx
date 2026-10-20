import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AccommodationCandidate } from '../../../shared/types'
import { api } from '../api'
import { AccommodationSearch } from '../components/AccommodationSearch'
import { ErrorNotice } from '../components/ui'
import { useNoIndex, usePageTitle, useStatus } from '../lib'

export function Plan() {
  usePageTitle('Plan my stay')
  useNoIndex()
  const status = useStatus()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const choose = async (c: AccommodationCandidate) => {
    setBusy(true)
    setError(null)
    try {
      const trip = await api.createTrip(c)
      navigate(`/trips/${trip.id}?step=stay`)
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="eyebrow">Step 1 of 4</p>
      <h1 className="mt-2 font-display text-4xl">Find your accommodation</h1>
      <p className="mt-3 text-muted">
        Search for the hotel, resort, lodge, guesthouse or apartment you’ve booked.
        Everything in your guide is measured from its location, so choose the exact
        property.
      </p>
      <div className="mt-8">
        <AccommodationSearch
          onChoose={choose}
          busy={busy}
          demo={status?.places.mode !== 'live'}
        />
      </div>
      {error ? (
        <div className="mt-4">
          <ErrorNotice error={error} />
        </div>
      ) : null}
    </div>
  )
}
