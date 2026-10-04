import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const credentialNames = new Set(['requestBody', 'credentials', 'password', 'data', 'errorData', 'access', 'refresh', 'token'])
function leaks(source) {
  const file = ts.createSourceFile('authApi.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const violations = []
  function sensitive(node) {
    if (ts.isIdentifier(node) && credentialNames.has(node.text)) return true
    let found = false
    ts.forEachChild(node, child => { if (sensitive(child)) found = true })
    return found
  }
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
        && ts.isIdentifier(node.expression.expression) && node.expression.expression.text === 'console') {
      if (node.arguments.some(sensitive)) violations.push(node.getText(file))
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return violations
}

test('auth logs never include credential or authentication response objects', () => {
  const source = fs.readFileSync(new URL('../src/utils/authApi.ts', import.meta.url), 'utf8')
  assert.deepEqual(leaks(source), [])
})

test('guard detects request/response dumps but allows status and static messages', () => {
  for (const name of ['requestBody', 'credentials', 'data', 'errorData']) {
    assert.equal(leaks(`console.log('debug', ${name})`).length, 1)
  }
  assert.equal(leaks("console.log('debug', {password: 'example'})").length, 1)
  assert.deepEqual(leaks("console.log('Login response status:', response.status); console.log('Access token stored')"), [])
})
