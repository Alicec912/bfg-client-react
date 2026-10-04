import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/auth/providers/', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ providers: [] }) })
  )
})

test('submits a password recovery email and confirms delivery', async ({ page }) => {
  let requestBody: Record<string, unknown> | undefined

  await page.route('**/api/v1/auth/forgot-password/', async route => {
    requestBody = route.request().postDataJSON()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Password reset email sent.' })
    })
  })

  await page.goto('/auth/forgot-password')
  await page.getByPlaceholder('Enter your email').fill('alice@example.com')
  await page.getByRole('button', { name: 'Send reset link' }).click()

  await expect(page.getByText('Reset link sent. Please check your inbox.')).toBeVisible()
  expect(requestBody).toEqual({ email: 'alice@example.com' })
})

test('blocks a reset attempt when the link has no token', async ({ page }) => {
  let resetRequests = 0

  await page.route('**/api/v1/auth/reset-password-confirm/', route => {
    resetRequests += 1
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })

  await page.goto('/auth/reset-password')

  await expect(page.getByText('Invalid password reset link. Please request a new one.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reset Password' })).toBeDisabled()
  expect(resetRequests).toBe(0)
})

test('rejects mismatched new passwords without calling the API', async ({ page }) => {
  let resetRequests = 0

  await page.route('**/api/v1/auth/reset-password-confirm/', route => {
    resetRequests += 1
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })

  await page.goto('/auth/reset-password?uid=user-42&token=reset-token')
  await page.locator('input[type="password"]').nth(0).fill('new-password')
  await page.locator('input[type="password"]').nth(1).fill('different-password')
  await page.getByRole('button', { name: 'Reset Password' }).click()

  await expect(page.getByText('Passwords do not match')).toBeVisible()
  expect(resetRequests).toBe(0)
})

test('submits a valid password reset payload', async ({ page }) => {
  let requestBody: Record<string, unknown> | undefined

  await page.route('**/api/v1/auth/reset-password-confirm/', async route => {
    requestBody = route.request().postDataJSON()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Password reset successfully.' })
    })
  })

  await page.goto('/auth/reset-password?uid=user-42&token=reset-token')
  await page.locator('input[type="password"]').nth(0).fill('new-password')
  await page.locator('input[type="password"]').nth(1).fill('new-password')
  await page.getByRole('button', { name: 'Reset Password' }).click()

  await expect(page.getByText('Password has been reset successfully. Redirecting to login...')).toBeVisible()
  expect(requestBody).toEqual({
    uid: 'user-42',
    token: 'reset-token',
    new_password: 'new-password',
    new_password_confirm: 'new-password'
  })
})
