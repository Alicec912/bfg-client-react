import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

function setup(api = 'https://api.example.com', page = 'https://shop.example.com', responder) {
  const values = new Map([['bfg_guest_cart_session', 'legacy-unsigned-uuid']])
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
    key: index => [...values.keys()][index] ?? null,
    get length() { return values.size }
  }
  const requests = []
  let workspaceToken = null
  const context = vm.createContext({
    window: { location: new URL(page), localStorage: storage },
    process: { env: { NODE_ENV: 'production' } }, console, URLSearchParams,
    fetch: async (url, options) => {
      requests.push({ url, ...options })
      if (responder) return responder(requests[requests.length - 1], requests.length)
      return { ok: true, status: 200, headers: { get: () => 'application/json' },
        json: async () => ({ id: 1, items: [], cart_token: 'server-signed-token' }) }
    }
  })
  function load(path, dependencies = {}) {
    const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
    }).outputText
    const exports = {}
    const run = vm.runInContext('(function(require, exports) {' + source + '\n})', context)
    run(name => { if (!(name in dependencies)) throw new Error('Unmocked dependency: ' + name); return dependencies[name] }, exports)
    return exports
  }
  const guest = load('../src/utils/guestCart.ts')
  const { storefrontApi } = load('../src/utils/storefrontApi.ts', {
    './guestCart': guest,
    './api': { getApiBaseUrl: () => api, getWorkspaceId: () => null },
    './authTokens': { getWorkspaceToken: () => workspaceToken },
    './tokenRefresh': { refreshTokenIfNeeded: async () => { workspaceToken = 'refreshed-login-token'; return workspaceToken } },
    './apiErrors': { getApiErrorMessage: () => null, WORKSPACE_READ_ONLY_CODE: 'workspace_read_only' },
    '@/i18n/http': { getApiLanguageHeaders: () => ({}), getCurrentLocale: () => 'en' }
  })
  return { storefrontApi, guest, requests, values, context }
}

for (const [api, page] of [
  ['http://localhost:8000', 'http://localhost:3000'],
  ['http://127.0.0.1:8000', 'http://localhost:3000'],
  ['https://localhost:8000', 'http://localhost:3000'],
  ['https://api.example.com', 'https://shop.example.com']
]) {
  test(`cart round trip: ${page} to ${api}`, async () => {
    const { storefrontApi, requests, guest } = setup(api, page)
    await storefrontApi.getCart()
    assert.equal(requests[0].headers['X-Bfg-Cart-Session'], undefined)
    await storefrontApi.getCart()
    assert.equal(requests[1].headers['X-Bfg-Cart-Session'], 'server-signed-token')
    assert.equal(requests[1].credentials, 'include')
    guest.clearGuestCartKey()
    await storefrontApi.getCart()
    assert.equal(requests[2].headers['X-Bfg-Cart-Session'], undefined)
  })
}
test('credentials are scoped and legacy keys are not reused', () => {
  const { guest, values } = setup()
  assert.equal(guest.getGuestCartToken('shop-a'), null)
  guest.saveGuestCartToken('shop-a', 'signed-a')
  assert.equal(guest.getGuestCartToken('shop-b'), null)
  assert.equal(guest.getGuestCartToken('shop-a'), 'signed-a')
  guest.saveGuestCartToken('shop-a', null)
  assert.equal(guest.getGuestCartToken('shop-a'), 'signed-a')
  guest.clearGuestCartKey()
  assert.equal(values.size, 0)
})
test('blocked storage falls back without failing the cart request', async () => {
  const { storefrontApi, requests, context } = setup()
  context.window.localStorage = { getItem() { throw Error('blocked') }, setItem() { throw Error('blocked') } }
  await storefrontApi.getCart()
  assert.equal(requests[0].headers['X-Bfg-Cart-Session'], undefined)
})

test('concurrent first cart reads share one initialization', async () => {
  const { storefrontApi, requests } = setup()
  await Promise.all([storefrontApi.getCart(), storefrontApi.getCart(), storefrontApi.getCartPreview()])
  assert.equal(requests.filter(request => request.url.endsWith('/current/')).length, 1)
  assert.equal(requests.at(-1).headers['X-Bfg-Cart-Session'], 'server-signed-token')
})
test('expired signed tokens are replaced once before retrying', async () => {
  const { storefrontApi, requests, guest } = setup(undefined, undefined, request => {
    const expired = request.headers['X-Bfg-Cart-Session'] === 'expired-token'
    const data = expired ? { cart_token: ['Invalid or expired cart token.'] } : { cart_token: 'new-signed-token' }
    const response = { ok: !expired, status: expired ? 400 : 200,
      headers: { get: () => 'application/json' }, json: async () => data }
    response.clone = () => response
    return response
  })
  guest.saveGuestCartToken(JSON.stringify(['https://api.example.com', 'shop.example.com', null]), 'expired-token')
  await Promise.all([storefrontApi.getCart(), storefrontApi.getCart()])
  assert.equal(requests.filter(request => !request.headers['X-Bfg-Cart-Session']).length, 1)
  await storefrontApi.getCart()
  assert.equal(requests.at(-1).headers['X-Bfg-Cart-Session'], 'new-signed-token')
})

test('cart initialization completes after login token refresh', { timeout: 2000 }, async () => {
  const { storefrontApi, requests } = setup(undefined, undefined, (request, count) => ({
    ok: count !== 1, status: count === 1 ? 401 : 200,
    headers: { get: () => 'application/json' },
    json: async () => ({ cart_token: 'server-signed-token' })
  }))
  await storefrontApi.getCart()
  assert.equal(requests.length, 2)
  assert.equal(requests[1].headers.Authorization, 'Bearer refreshed-login-token')
})
