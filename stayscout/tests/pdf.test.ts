import { describe, expect, it } from 'vitest'
import { pdfSafe } from '../server/pdf.js'
import { client, readyTrip, setup } from './helpers.js'

describe('PDF text', () => {
  it('keeps Latin, Greek and Cyrillic; replaces only characters the font lacks', () => {
    expect(pdfSafe('Zürich · Ελλάδα · Москва — “ok”')).toBe(
      'Zürich · Ελλάδα · Москва — “ok”',
    )
    expect(pdfSafe('東京 Tower')).toBe('?? Tower')
    expect(pdfSafe('a\u0000b\nc')).toBe('a?b\nc')
  })

  it('renders a guide whose places have non-Latin names', async () => {
    const { app, store } = setup()
    const c = client(app)
    const { id } = await readyTrip(c)
    const places = await store.getPlaces(id)
    await store.replacePlaces(
      id,
      places.map((p, i) => ({
        ...p.record,
        name: i % 2 ? `Μουσείο ${i}` : `Музей ${i} 博物館`,
      })),
    )
    await c.post(`/api/trips/${id}/itinerary`, { useAi: false })
    const r = await c.get(`/api/trips/${id}/guide.pdf`)
    expect(r.status).toBe(200)
    const pdf = r.data as Buffer
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
    expect(pdf.toString('latin1')).toContain('DejaVuSans')
  })
})
