import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  // Keep login tests independent of provider discovery and the real backend.
  await page.route('**/api/v1/auth/providers/', route =>
    route.fulfill({ json: { providers: [] } })
  )
})

test('logs in with a username, stores the session, and respects an explicit redirect', async ({ page }) => {
  let requestBody: Record<string, unknown> | undefined
  await page.route('**/api/v1/auth/token/', async route => {
    expect(route.request().method()).toBe('POST')
    requestBody = route.request().postDataJSON()
    await route.fulfill({ json: { access: 'login-access', refresh: 'login-refresh' } })
  })

  await page.goto('/auth/login?redirect=%2Funknown')
  await page.getByPlaceholder('Enter your email or username').fill('alice-test')
  await page.locator('input[type="password"]').fill('test-password')
  await page.getByRole('button', { name: 'Login', exact: true }).click()

  // An inert destination isolates redirect behavior from account/admin API calls.
  await expect(page).toHaveURL(/\/unknown$/)
  expect(requestBody).toEqual({ username: 'alice-test', password: 'test-password' })
  const storage = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)))
  expect(storage).toMatchObject({
    'bfg_jwt:workspace:http://127.0.0.1:8787': 'login-access',
    'bfg_refresh:workspace:http://127.0.0.1:8787': 'login-refresh'
  })
})

test('recovers from a network failure and allows a successful retry', async ({ page }) => {
  let requests = 0
  await page.route('**/api/v1/auth/token/', async route => {
    requests += 1
    if (requests === 1) return route.abort('failed')
    await route.fulfill({ json: { access: 'retry-access', refresh: 'retry-refresh' } })
  })

  await page.goto('/auth/login?redirect=%2Funknown')
  await page.getByPlaceholder('Enter your email or username').fill('alice@example.com')
  await page.locator('input[type="password"]').fill('test-password')
  const login = page.getByRole('button', { name: 'Login', exact: true })
  await login.click()
  await expect(page.locator('.auth-error')).toBeVisible()
  await expect(login).toBeEnabled()
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('bfg_jwt:')))).toEqual([])

  await login.click()
  await expect(page).toHaveURL(/\/unknown$/)
  expect(requests).toBe(2)
  expect(await page.evaluate(() => localStorage.getItem('bfg_jwt:workspace:http://127.0.0.1:8787'))).toBe('retry-access')
})

test('disables login while a request is pending and restores it after rejection', async ({ page }) => {
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  let requests = 0
  await page.route('**/api/v1/auth/token/', async route => {
    requests += 1
    await pending
    await route.fulfill({ status: 401, json: { detail: 'Credentials rejected' } })
  })

  await page.goto('/auth/login')
  await page.getByPlaceholder('Enter your email or username').fill('alice@example.com')
  await page.locator('input[type="password"]').fill('test-password')
  const button = page.locator('button.auth-button')
  await button.click()
  try {
    await expect.poll(() => requests).toBe(1)
    await expect(button).toBeDisabled()
  } finally {
    release()
  }
  await expect(page.getByText('Credentials rejected', { exact: true })).toBeVisible()
  await expect(button).toBeEnabled()
  expect(requests).toBe(1)
})
