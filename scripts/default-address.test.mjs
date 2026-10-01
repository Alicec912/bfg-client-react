import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

function client(status, detail) {
  const logs = []
  const dependencies = {
    './tokenRefresh': { refreshTokenIfNeeded: async () => null },
    './api': { getApiBaseUrl: () => 'https://api.example.com', getWorkspaceId: () => null },
    './authTokens': { getWorkspaceToken: () => 'signed-in-token' },
    '@/i18n/http': { getApiLanguageHeaders: () => ({}) }
  }
  const response = { ok: false, status, statusText: 'Test status',
    headers: { get: () => 'application/json' }, json: async () => ({ detail }) }
  response.clone = () => response
  const context = vm.createContext({
    window: { location: new URL('https://shop.example.com/account') }, FormData,
    fetch: async () => response,
    console: { warn: (...args) => logs.push(args), error: (...args) => logs.push(args) }
  })
  const code = ts.transpileModule(readFileSync(new URL('../src/utils/meApi.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText
  const exports = {}
  vm.runInContext('(function(require, exports) {' + code + '\n})', context)(name => dependencies[name], exports)
  return { api: exports.meApi, logs }
}

test('missing default address remains a 404 for callers without an error log', async () => {
  const { api, logs } = client(404, 'No default address found')
  await assert.rejects(api.getDefaultAddress(), error => error.status === 404 && error.data.detail === 'No default address found')
  assert.equal(logs.length, 0)
})
test('unrecognized default-address 404 still reports a real failure', async () => {
  const { api, logs } = client(404, 'Not found.')
  await assert.rejects(api.getDefaultAddress(), error => error.status === 404)
  assert.equal(logs.length, 1)
})
test('default-address server errors still report a real failure', async () => {
  const { api, logs } = client(500, 'Database unavailable')
  await assert.rejects(api.getDefaultAddress(), error => error.status === 500)
  assert.equal(logs.length, 1)
})
