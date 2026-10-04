import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/auth/providers/', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ providers: [] }) })
  )
})

test('redirects a callback without an access token to login', async ({ page }) => {
  await page.goto('/auth/callback#refresh=orphaned-refresh-token')

  await expect(page).toHaveURL(/\/auth\/login$/)
  await expect(page.getByRole('button', { name: 'Login' })).toBeVisible()
})

test('stores callback credentials, clears the hash, and follows the redirect', async ({ page }) => {
  await page.goto(
    '/auth/callback#access=access-token&refresh=refresh-token&redirect=%2Funknown&workspace_id=workspace-42'
  )

  await expect(page).toHaveURL(/\/unknown$/)
  expect(page.url()).not.toContain('#')

  const storage = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)))

  expect(storage).toMatchObject({
    'bfg_jwt:workspace:http://127.0.0.1:8787': 'access-token',
    'bfg_refresh:workspace:http://127.0.0.1:8787': 'refresh-token',
    workspace_id: 'workspace-42'
  })
})
