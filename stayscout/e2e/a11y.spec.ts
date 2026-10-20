import AxeBuilder from '@axe-core/playwright'
import { expect, test, type APIRequestContext } from '@playwright/test'

async function plannedTrip(request: APIRequestContext) {
  const id = (
    await (
      await request.post('/api/trips', {
        data: { provider: 'demo', providerPlaceId: 'demo-acc-kestrel-resort' },
      })
    ).json()
  ).id
  await request.post(`/api/trips/${id}/accommodation/confirm`, { data: {} })
  await request.put(`/api/trips/${id}/preferences`, {
    data: {
      checkIn: '2026-12-10',
      checkOut: '2026-12-13',
      adults: 2,
      childAgeRanges: ['6-12'],
      interests: ['beaches'],
    },
  })
  await request.post(`/api/trips/${id}/discover`, { data: {} })
  await request.post(`/api/trips/${id}/itinerary`, { data: { useAi: false } })
  return id as string
}

test('WCAG 2.1 AA automated scan finds no violations on any page', async ({ page }) => {
  // Scan the settled page, not mid fade-in (animation blends colours).
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const id = await plannedTrip(page.request)
  const paths = [
    '/',
    '/plan',
    `/trips/${id}?step=stay`,
    `/trips/${id}?step=prefs`,
    `/trips/${id}?step=discover`,
    `/trips/${id}?step=plan`,
    '/sample',
    '/trips',
    '/privacy',
    '/terms',
    '/nope',
  ]
  for (const path of paths) {
    await page.goto(path)
    await page.locator('main h1, main h2').first().waitFor()
    const r = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(r.violations.map((v) => `${path}: ${v.id} (${v.nodes.length})`)).toEqual([])
  }
})

test('content reflows at 320 CSS px with no horizontal scrolling (WCAG 1.4.10)', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'desktop', 'one viewport is enough')
  await page.setViewportSize({ width: 320, height: 640 })
  const id = await plannedTrip(page.request)
  for (const path of [
    '/',
    '/plan',
    `/trips/${id}?step=discover`,
    `/trips/${id}?step=plan`,
    '/sample',
  ]) {
    await page.goto(path)
    await page.locator('main h1, main h2').first().waitFor()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    )
    expect(overflow, path).toBeLessThanOrEqual(1)
  }
})

test('changing trip step moves keyboard focus to the new step heading', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'mobile', 'keyboard flow is a desktop check')
  const id = await plannedTrip(page.request)
  await page.goto(`/trips/${id}?step=plan`)
  await page
    .getByRole('navigation', { name: 'Trip steps' })
    .getByRole('button', { name: /Places/ })
    .click()
  await expect(page.getByRole('heading', { name: 'Places within 50 km' })).toBeFocused()
})
