// Non-component helpers shared by pages and components. Kept out of the
// component files so React fast refresh works on those.

import { createContext, useContext, useEffect } from 'react'
import type { ProviderStatus, TripPlace } from '../../shared/types'

export const RADIUS_NOTICE =
  'All included attractions are within 50 km straight-line distance of your confirmed stay. Driving distances and travel times may be longer.'

export const StatusContext = createContext<ProviderStatus | null>(null)
export const useStatus = () => useContext(StatusContext)

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title
      ? `${title} · StayScout`
      : 'StayScout — plan around where you’re staying'
  }, [title])
}

/** Private pages shouldn't be indexed even if a link leaks. */
export function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])
}

export const CATEGORY_LABEL: Record<string, string> = {
  nature: 'Nature & viewpoints',
  beach: 'Beaches & swimming',
  park: 'Parks & gardens',
  wildlife: 'Wildlife',
  culture: 'Museums, history & culture',
  tour: 'Tours & experiences',
  food: 'Food & drink',
  family: 'Family & children',
  shopping: 'Shopping & markets',
  adventure: 'Adventure & sport',
  wellness: 'Wellness',
  rainy_day: 'Rainy-day',
  practical: 'Practical services',
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const PRICE_LABEL: Record<string, string> = {
  free: 'Free',
  low: '$',
  moderate: '$$',
  high: '$$$',
  very_high: '$$$$',
}

export function priceText(p: TripPlace): string {
  if (!p.price) return 'Price not verified'
  const { amount, level } = p.price.value
  if (amount)
    return `${amount.currency} ${amount.min}${amount.max !== amount.min ? `–${amount.max}` : ''} pp`
  return level ? PRICE_LABEL[level]! : 'Price not verified'
}

export function hoursText(p: TripPlace): string {
  if (!p.openingHours) return 'Opening hours not verified'
  const byDay = DAYS.map((d, i) => {
    const h = p.openingHours!.value.filter((x) => x.day === i)
    return `${d} ${h.length ? h.map((x) => `${x.open}–${x.close}`).join(', ') : 'closed'}`
  })
  return byDay.join(' · ')
}

export function directionsUrl(p: TripPlace): string | null {
  if (p.isSample) return null
  return (
    p.mapsUrl ??
    `https://www.openstreetmap.org/directions?to=${p.location.lat}%2C${p.location.lng}`
  )
}

export function fmtDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
