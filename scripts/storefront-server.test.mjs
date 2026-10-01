import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolveStorefrontServerProvider } from '../src/extensions/storefrontServerCore.ts'
import { isExtensionEnabled } from '../src/extensions/availability.ts'

test('workspace-disabled and deployment-excluded providers are never loaded', async () => {
  let calls = 0
  const loaders = { fixture: async () => { calls++; return { default: { matches: () => true } } } }
  const disabled = { extensions: { offered: ['fixture'], available: [] } }
  assert.equal(await resolveStorefrontServerProvider(loaders, disabled, undefined, id => isExtensionEnabled(id, disabled.extensions)), null)
  assert.equal(await resolveStorefrontServerProvider(loaders, null, ['other'], () => true), null)
  assert.equal(await resolveStorefrontServerProvider(loaders, null, [], () => true), null)
  assert.equal(calls, 0)
})

test('provider scope isolates workspaces sharing one skin', async () => {
  const provider = { matches: config => config?.theme === 'fixture' && config?.workspace_slug === 'chosen' }
  const loaders = { fixture: async () => ({ default: provider }) }
  assert.equal(await resolveStorefrontServerProvider(loaders, { theme: 'fixture', workspace_slug: 'other' }, undefined, () => true), null)
  assert.equal(await resolveStorefrontServerProvider(loaders, { theme: 'fixture', workspace_slug: 'chosen' }, undefined, () => true), provider)
})

test('ambiguous ownership and failed provider imports are explicit errors', async () => {
  const provider = { matches: () => true }
  await assert.rejects(resolveStorefrontServerProvider({ one: async () => ({ default: provider }), two: async () => ({ default: provider }) }, null, undefined, () => true), /Multiple/)
  await assert.rejects(resolveStorefrontServerProvider({ broken: async () => { throw new Error('load failed') } }, null, undefined, () => true), /load failed/)
})
