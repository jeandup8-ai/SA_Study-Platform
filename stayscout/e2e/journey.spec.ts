import { expect, test, type Page } from '@playwright/test'

const RADIUS_TEXT =
  'All included attractions are within 50 km straight-line distance of your confirmed stay.'

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
}

test('landing explains the product and links to planning', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Your stay is booked',
  )
  await expect(page.getByText('Demo mode:')).toBeVisible()
  await expect(page.getByText(/USD 9\.00, one-time/)).toBeVisible()
  await noHorizontalScroll(page)
  await page.getByRole('main').getByRole('link', { name: 'Plan my stay' }).click()
  await expect(page).toHaveURL(/\/plan$/)
})

test('full demo journey: stay → preferences → places → plan → edit → PDF → share', async ({
  page,
  context,
}) => {
  await page.goto('/plan')

  // Empty query is caught in the browser with a helpful message.
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('at least two characters')

  // Ambiguous name: two lodges, each with a distinguishing line.
  await page.getByLabel('Where are you staying?').fill('Harbour View Lodge')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  const results = page.getByRole('list', { name: 'Matching stays' }).getByRole('listitem')
  await expect(results).toHaveCount(2)
  await expect(results.nth(0)).toContainText('Kestrel Bay')
  await expect(results.nth(1)).toContainText('Marrow Point')

  // Choose the resort instead.
  await page.getByLabel('Where are you staying?').fill('Kestrel Bay Beach Resort')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page.getByRole('button', { name: 'This is my stay' }).click()
  await expect(
    page.getByRole('heading', { name: 'Confirm where you’re staying' }),
  ).toBeVisible()
  await expect(page.getByText('Sample data.')).toBeVisible()
  await page.getByRole('button', { name: 'Yes, this is the right place' }).click()

  // Questionnaire with validation and back navigation.
  await expect(page.getByRole('heading', { name: 'About your trip' })).toBeVisible()
  await page.getByLabel('Check-in').fill('2026-12-10')
  await page.getByLabel('Check-out').fill('2026-12-09')
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText('Check-out must be after check-in')).toBeVisible()
  await page.getByLabel('Check-out').fill('2026-12-13')
  await page.getByRole('button', { name: '6-12 yrs' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel('Getting around').selectOption('rental_car')
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.getByLabel('Check-out')).toHaveValue('2026-12-13')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Beaches' }).click()
  await page.getByRole('button', { name: 'History' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Save and find places' }).click()

  // Discovery: radius notice, rejected places explained, filters work.
  await expect(page.getByRole('heading', { name: 'Places within 50 km' })).toBeVisible()
  await expect(page.getByText(RADIUS_TEXT).first()).toBeVisible()
  await expect(page.getByText(/more than 50 km away/)).toBeVisible()
  await expect(page.getByText('Glass Lake National Reserve')).toHaveCount(0)
  await page.getByLabel('Category').selectOption('culture')
  await expect(
    page.getByRole('heading', { name: 'Kestrel Bay Maritime Museum' }),
  ).toBeVisible()
  await page
    .getByRole('article', { name: 'Kestrel Bay Maritime Museum' })
    .getByRole('button', { name: 'Add to plan' })
    .click()
  await expect(
    page
      .getByRole('article', { name: 'Kestrel Bay Maritime Museum' })
      .getByRole('button', { name: '✓ In my plan' }),
  ).toBeVisible()
  await page.getByLabel('Category').selectOption('all')
  await page.getByLabel('Search results').fill('snorkel')
  const snorkel = page.getByRole('article', { name: 'Kelp Forest Snorkel Tours' })
  await snorkel.getByRole('button', { name: 'Details & sources' }).click()
  await expect(snorkel.getByText('StayScout sample dataset (fictional)')).toBeVisible()
  await snorkel.getByRole('button', { name: 'Add to plan' }).click()
  await noHorizontalScroll(page)

  // Build the plan.
  await page.getByRole('button', { name: 'Build my plan' }).click()
  await expect(page.getByRole('heading', { name: /Day 1 · .* · Arrival/ })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: /Day 4 · .* · Departure/ }),
  ).toBeVisible()
  await expect(page.getByText('Kestrel Bay Maritime Museum').first()).toBeVisible()
  await expect(page.getByText('Kelp Forest Snorkel Tours').first()).toBeVisible()
  await expect(page.getByText(/Age check: listed minimum age is 8/)).toBeVisible()
  await expect(page.getByText('Safety & official advice')).toBeVisible()
  await expect(page.getByText('Sample destination — no advisory exists')).toBeVisible()
  await noHorizontalScroll(page)

  // Edit: remove an item, then regenerate one day only.
  const day2 = page.getByRole('region', { name: /Day 2/ })
  const before = await day2.getByRole('listitem').count()
  await day2
    .getByRole('button', { name: /^Remove / })
    .first()
    .click()
  await expect(day2.getByRole('listitem')).toHaveCount(before - 1)
  const day1Text = await page.getByRole('region', { name: /Day 1/ }).innerText()
  await page
    .getByRole('region', { name: /Day 3/ })
    .getByRole('button', { name: 'Regenerate this day only' })
    .click()
  await expect(
    page.getByText('Day 3 regenerated. Other days are unchanged.'),
  ).toBeVisible()
  expect(await page.getByRole('region', { name: /Day 1/ }).innerText()).toBe(day1Text)

  // PDF comes from the saved plan.
  const pdf = await page.request.get(
    (await page
      .getByRole('link', { name: 'Download PDF' })
      .getAttribute('href')) as string,
  )
  expect(pdf.status()).toBe(200)
  expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-')

  // Share read-only, open in a fresh browser context.
  await page.getByRole('button', { name: 'Create share link' }).click()
  const url = await page.getByLabel('Share link').inputValue()
  expect(url).toMatch(/\/g\/[A-Za-z0-9_-]{43}$/)
  const other = await context.browser()!.newContext()
  const viewer = await other.newPage()
  await viewer.goto(url)
  await expect(
    viewer.getByText('A read-only StayScout guide shared with you.'),
  ).toBeVisible()
  await expect(viewer.getByRole('button', { name: /^Remove / })).toHaveCount(0)
  // The other browser cannot open the private trip page.
  await viewer.goto(page.url().split('?')[0]!)
  await expect(viewer.getByText('Trip not found')).toBeVisible()
  await other.close()

  // Trip is listed under My trips in this browser.
  await page.getByRole('link', { name: 'My trips' }).click()
  await expect(page.getByRole('link', { name: /Kestrel Bay Beach Resort/ })).toBeVisible()
})

test('area-centre selection needs explicit acknowledgement', async ({ page }) => {
  await page.goto('/plan')
  await page.getByRole('button', { name: 'Just a destination' }).click()
  await page.getByLabel('Where are you staying?').fill('Kestrel')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page.getByRole('button', { name: 'This is my stay' }).click()
  const confirm = page.getByRole('button', { name: 'Yes, this is the right place' })
  await expect(
    page.getByText('This is a town or area centre, not a specific property.'),
  ).toBeVisible()
  await expect(confirm).toBeDisabled()
  await page.getByLabel('I understand — measure from this area centre.').check()
  await expect(confirm).toBeEnabled()
})

test('sample guide is explorable without an account and clearly labelled', async ({
  page,
}) => {
  await page.goto('/sample')
  await expect(
    page.getByRole('heading', { name: 'What a StayScout guide looks like' }),
  ).toBeVisible()
  await expect(page.getByText('Sample data.')).toBeVisible()
  await expect(page.getByText(RADIUS_TEXT)).toBeVisible()
  await expect(page.getByRole('heading', { name: /Day 1/ })).toBeVisible()
  await noHorizontalScroll(page)
})

test('unknown routes show a helpful not-found page', async ({ page }) => {
  await page.goto('/no-such-page')
  await expect(
    page.getByRole('heading', { name: 'This page is outside our radius' }),
  ).toBeVisible()
})

test('keyboard users can skip to content and reach the main CTA', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'mobile', 'keyboard flow is a desktop check')
  await page.goto('/')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Tab')
  await expect(
    page.getByRole('main').getByRole('link', { name: 'Plan my stay' }),
  ).toBeFocused()
})
