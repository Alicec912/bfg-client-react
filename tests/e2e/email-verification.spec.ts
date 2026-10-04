import { expect, test } from '@playwright/test'

test('rejects a verification link without a token before calling the API', async ({ page }) => {
  let verificationRequests = 0

  await page.route('**/api/v1/auth/verify-email/', route => {
    verificationRequests += 1
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })

  await page.goto('/auth/verify-email')

  await expect(page.getByText('Invalid verification link. Please request a new one.')).toBeVisible()
  expect(verificationRequests).toBe(0)
})

test('submits the verification token and displays the success state', async ({ page }) => {
  let requestBody: Record<string, unknown> | undefined

  await page.route('**/api/v1/auth/verify-email/', async route => {
    requestBody = route.request().postDataJSON()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Email verified.' })
    })
  })

  await page.goto('/auth/verify-email?token=verification-token')

  await expect(page.getByText('Email verified successfully. You can now sign in.')).toBeVisible()
  expect(requestBody).toEqual({ key: 'verification-token' })
  await expect(page.getByRole('button', { name: 'Go to Login' })).toBeVisible()
})

test('displays an error when the verification token is rejected', async ({ page }) => {
  await page.route('**/api/v1/auth/verify-email/', route =>
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Invalid or expired token.' })
    })
  )

  await page.goto('/auth/verify-email?key=expired-token')

  await expect(page.getByText('Verification failed. The link may have expired.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create an account' })).toBeVisible()
})
