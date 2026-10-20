// PDF guide. Rendered only from a saved itinerary that has just passed
// validation (see TripService.exportableView) — never from a fresh AI call.

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import * as fontkit from 'fontkit'
import PDFDocument from 'pdfkit'
import { formatDistance } from '../shared/geo.js'
import type {
  SafetyPanel,
  TripPlace,
  TripView,
  VerificationStatus,
} from '../shared/types.js'

const INK = '#1c1917'
const MUTED = '#57534e'
const ACCENT = '#0f5e5a'
const WARN = '#9a3412'

export const RADIUS_NOTICE =
  'All included attractions are within 50 km straight-line distance of your confirmed stay. Driving distances and travel times may be longer.'

const STATUS_LABEL: Record<VerificationStatus, string> = {
  VERIFIED_SOURCE: 'verified against source',
  PROVIDER_LISTED: 'as listed by provider',
  ESTIMATED: 'estimate',
  UNVERIFIED: 'not verified',
  UNAVAILABLE: 'could not be checked',
}

// Embedded DejaVu fonts (Bitstream Vera licence: free to embed and
// redistribute) cover Latin, Greek, Cyrillic and many other scripts. Any
// character they lack (e.g. Chinese, Japanese, Korean) becomes "?" rather
// than an empty box. pdfkit does not do right-to-left shaping, so Arabic and
// Hebrew names print in the right glyphs but not in the right order.
const fontDir = path.join(
  path.dirname(createRequire(import.meta.url).resolve('dejavu-fonts-ttf/package.json')),
  'ttf',
)
const FONTS = {
  Body: readFileSync(path.join(fontDir, 'DejaVuSans.ttf')),
  Bold: readFileSync(path.join(fontDir, 'DejaVuSans-Bold.ttf')),
  Heading: readFileSync(path.join(fontDir, 'DejaVuSerif-Bold.ttf')),
}
const bodyGlyphs = fontkit.create(FONTS.Body) as {
  hasGlyphForCodePoint(cp: number): boolean
}

export function pdfSafe(s: string): string {
  let out = ''
  for (const ch of s.normalize('NFC')) {
    const cp = ch.codePointAt(0)!
    out += ch === '\n' || (cp >= 0x20 && bodyGlyphs.hasGlyphForCodePoint(cp)) ? ch : '?'
  }
  return out
}

export function renderGuidePdf(
  view: TripView,
  safety: SafetyPanel | null,
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    info: {
      Title: pdfSafe(`StayScout guide — ${view.accommodation?.name ?? ''}`),
      Author: 'StayScout',
    },
  })
  for (const [name, data] of Object.entries(FONTS)) doc.registerFont(name, data)
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })

  const a = view.accommodation!
  const prefs = view.preferences
  const itin = view.itinerary!
  const byId = new Map(view.places.map((p) => [p.id, p]))
  const text = (s: string, opts: PDFKit.Mixins.TextOptions = {}) =>
    doc.text(pdfSafe(s), opts)

  doc.fillColor(ACCENT).font('Bold').fontSize(10).text('STAYSCOUT')
  doc.moveDown(0.3)
  doc.fillColor(INK).font('Heading').fontSize(24)
  text(`Your stay at ${a.name}`)
  doc.font('Body').fontSize(10).fillColor(MUTED)
  if (prefs)
    text(
      `${prefs.checkIn} to ${prefs.checkOut} · ${prefs.adults} adult${prefs.adults === 1 ? '' : 's'}${prefs.childAgeRanges.length ? ` · ${prefs.childAgeRanges.length} child${prefs.childAgeRanges.length === 1 ? '' : 'ren'}` : ''}`,
    )
  text(`${a.address ?? 'Address not available'}`)
  text(
    `Confirmed location: ${a.location.lat.toFixed(5)}, ${a.location.lng.toFixed(5)}${a.isAreaCentre ? ' (area centre, not a specific property)' : ''}`,
  )
  doc.moveDown(0.6)

  if (a.isSample) {
    doc.fillColor(WARN).font('Bold')
    text(
      'SAMPLE DATA: this guide uses a fictional destination and fictional places for demonstration only.',
    )
    doc.moveDown(0.4)
  }
  doc.fillColor(ACCENT).font('Bold').fontSize(10)
  text(RADIUS_NOTICE)
  doc.moveDown(0.8)

  for (const w of itin.warnings) {
    doc.fillColor(WARN).font('Body').fontSize(9)
    text(`Note: ${w}`)
  }

  for (const day of itin.days) {
    doc.moveDown(0.8)
    doc.fillColor(INK).font('Heading').fontSize(15)
    text(`${day.label} — ${day.date}`)
    doc.font('Body').fontSize(9).fillColor(MUTED)
    const cost = day.estimatedCost
    text(
      cost
        ? `Known activity costs: ${cost.currency} ${cost.min.toFixed(0)}${cost.max !== cost.min ? `–${cost.max.toFixed(0)}` : ''} for your group${day.unpricedItems ? ` (+${day.unpricedItems} item(s) with unknown cost)` : ''}`
        : 'Activity costs: not known for this day',
    )
    for (const n of day.notes) text(n)
    doc.moveDown(0.3)
    for (const item of day.items) {
      const place = item.placeId ? byId.get(item.placeId) : undefined
      doc.fillColor(INK).font('Bold').fontSize(11)
      text(`${item.startTime}  ${item.title}  (${item.durationMinutes} min, estimated)`)
      doc.font('Body').fontSize(9).fillColor(MUTED)
      if (place) placeLines(place).forEach((l) => text(l, { indent: 36 }))
      if (item.travelMinutesEstimate)
        text(
          `Rough travel estimate from previous stop: ${item.travelMinutesEstimate} min (not live traffic)`,
          { indent: 36 },
        )
      for (const n of item.notes) text(`• ${n}`, { indent: 36 })
      doc.moveDown(0.3)
    }
  }

  doc.addPage()
  doc.fillColor(INK).font('Heading').fontSize(16)
  text('Safety information')
  doc.font('Body').fontSize(9).fillColor(MUTED)
  if (safety) {
    for (const e of safety.entries) {
      doc.font('Bold').fillColor(INK)
      text(e.title)
      doc.font('Body').fillColor(MUTED)
      text(e.summary)
      if (e.source?.url)
        text(
          `Source: ${e.source.publisher} — ${e.source.url}${e.source.publishedAt ? ` (updated ${e.source.publishedAt.slice(0, 10)})` : ''}; checked ${e.source.checkedAt.slice(0, 16).replace('T', ' ')} UTC`,
        )
      for (const l of e.limitations) text(`Limitation: ${l}`)
      doc.moveDown(0.4)
    }
    text('Official sources to check:')
    for (const l of safety.officialLinks) text(`${l.title}: ${l.url}`)
    doc.moveDown(0.4)
    text(safety.disclaimer)
  } else {
    text(
      'Safety information could not be retrieved when this PDF was created. Check official travel advice before you go.',
    )
  }

  doc.moveDown(1)
  doc.fillColor(INK).font('Heading').fontSize(16)
  text('About this data')
  doc.font('Body').fontSize(9).fillColor(MUTED)
  text(
    'Distances are straight-line (great-circle) from your confirmed stay. Visit durations and travel times are estimates. Opening hours and prices are shown with their source and may have changed — confirm with each venue. Nothing in this guide has been booked.',
  )
  const attributions = [...new Set(view.places.map((p) => p.attribution).filter(Boolean))]
  if (attributions.length) text(attributions.join(' · '))
  text(
    `Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC from saved plan version ${itin.version}.`,
  )

  doc.end()
  return done
}

function placeLines(p: TripPlace): string[] {
  const lines = [
    `${p.address ?? 'Address not available'} · ${formatDistance(p.distanceMeters)} straight-line from your stay`,
  ]
  if (p.price) {
    const amt = p.price.value.amount
    lines.push(
      `Price: ${amt ? `${amt.currency} ${amt.min}${amt.max !== amt.min ? `–${amt.max}` : ''} per person` : (p.price.value.level ?? 'unknown')} (${STATUS_LABEL[p.price.status]}${p.price.source ? `, ${p.price.source.publisher}` : ''})`,
    )
  } else lines.push('Price: not verified')
  lines.push(
    p.openingHours
      ? `Opening hours: ${STATUS_LABEL[p.openingHours.status]}${p.openingHours.source ? ` (${p.openingHours.source.publisher}, checked ${p.openingHours.source.checkedAt.slice(0, 10)})` : ''}`
      : 'Opening hours: not verified',
  )
  if (p.websiteUrl) lines.push(`Website: ${p.websiteUrl}`)
  if (p.mapsUrl) lines.push(`Map: ${p.mapsUrl}`)
  if (p.isSample) lines.push('Sample place — fictional.')
  return lines
}
