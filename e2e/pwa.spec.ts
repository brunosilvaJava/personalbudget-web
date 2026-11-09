import { expect, test } from '@playwright/test'

test('serves an installable manifest', async ({ page, request }) => {
  await page.goto('/')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(href).toBeTruthy()

  const response = await request.get(href!)
  expect(response.ok()).toBe(true)
  const manifest = (await response.json()) as {
    name: string
    display: string
    start_url: string
    icons: { src: string; sizes: string; purpose?: string }[]
  }
  expect(manifest).toMatchObject({ name: 'PersonalBudget', display: 'standalone', start_url: '/' })
  expect(manifest.icons.map((icon) => icon.sizes)).toEqual(
    expect.arrayContaining(['192x192', '512x512']),
  )
  expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true)
  for (const icon of manifest.icons) {
    expect((await request.get(icon.src)).ok(), `icon ${icon.src}`).toBe(true)
  }
})

test('opens the app without a connection once the service worker is in place', async ({
  page,
  context,
}) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  // The first load is not under the worker's control until the page loads again.
  await page.reload()
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true)

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('status').filter({ hasText: 'Sem conexão' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Início' })).toBeVisible()
})

test('refuses to cache the API: a balance is never served from the worker', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  const cached = await page.evaluate(async () => {
    const urls: string[] = []
    for (const name of await caches.keys()) {
      const cache = await caches.open(name)
      for (const request of await cache.keys()) urls.push(new URL(request.url).pathname)
    }
    return urls
  })
  expect(cached.length).toBeGreaterThan(0)
  expect(cached.filter((path) => path.startsWith('/api'))).toEqual([])
})
