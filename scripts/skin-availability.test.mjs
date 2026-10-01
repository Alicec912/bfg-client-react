import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import ts from 'typescript'
const require = createRequire(import.meta.url)
function load(file) {
  const module = {exports:{}}
  const javascript = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  new Function('require', 'module', 'exports', javascript)(id => id === './availability' ? load('../src/extensions/availability.ts') : require(id), module, module.exports)
  return module.exports
}
const { isSkinEnabled, getEffectiveTheme } = load('../src/extensions/skinAvailability.ts')
test('skin owner, workspace, missing configuration and built-in fallback are enforced', () => {
  const metadata = {store:{extensionId:'builtin'}, friendly:{extensionId:'fixture',workspaceSlugs:['chosen']}}
  assert.equal(getEffectiveTheme('friendly', metadata, {workspace_slug:'chosen'}), 'friendly')
  assert.equal(getEffectiveTheme('friendly', metadata, {workspace_slug:'other'}), 'store')
  assert.equal(getEffectiveTheme('friendly', metadata, null), 'store')
  assert.equal(getEffectiveTheme('friendly', metadata, {workspace_slug:'chosen',extensions:{offered:['fixture'],available:[]}}), 'store')
  assert.equal(getEffectiveTheme('friendly', {store:metadata.store}, {workspace_slug:'chosen'}), 'store')
  assert.equal(isSkinEnabled({extensionId:'fixture'}, {extensions:{offered:['fixture'],available:['fixture']}}), true)
  assert.equal(getEffectiveTheme('store', metadata, null), 'store')
})
test('runtime deployment exclusion applies to skins without affecting built-ins', () => {
  const previous=process.env.ENABLED_PLUGINS
  try {
    process.env.ENABLED_PLUGINS=''
    assert.equal(isSkinEnabled({extensionId:'fixture'}, null), false)
    assert.equal(isSkinEnabled({extensionId:'builtin'}, null), true)
    process.env.ENABLED_PLUGINS='fixture'
    assert.equal(isSkinEnabled({extensionId:'fixture'}, null), true)
  } finally { if(previous===undefined) delete process.env.ENABLED_PLUGINS; else process.env.ENABLED_PLUGINS=previous }
})
