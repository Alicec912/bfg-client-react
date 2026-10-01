import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, copyFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'bfg-skin-registry-'))
  const client = join(root, 'client')
  mkdirSync(join(client, 'scripts'), { recursive: true })
  copyFileSync(new URL('./prepare.js', import.meta.url), join(client, 'scripts/prepare.js'))
  const skin = (directory, metadata = {}) => {
    mkdirSync(join(directory, 'storefront'), { recursive: true })
    writeFileSync(join(directory, 'manifest.json'), JSON.stringify({ label: 'Manifest label', supportedColorModes: ['light'] }))
    for (const component of ['Layout', 'Header', 'Footer']) writeFileSync(join(directory, `storefront/${component}.tsx`), 'export default function Component() { return null }')
    writeFileSync(join(directory, 'storefront/theme.json'), JSON.stringify(metadata))
    for (const area of ['account', 'auth']) {
      mkdirSync(join(directory, area), { recursive: true })
      writeFileSync(join(directory, area, 'Layout.tsx'), 'export default function Layout() { return null }')
    }
  }
  try { run({ root, client, skin, prepare: () => execFileSync(process.execPath, [join(client, 'scripts/prepare.js')], { encoding: 'utf8', stdio: 'pipe' }) }) }
  finally { rmSync(root, { recursive: true, force: true }) }
}

test('sibling extension skins retain ownership, metadata and color restrictions', () => fixture(({ root, client, skin, prepare }) => {
  skin(join(client, 'src/skins/builtin-light'), { displayName: 'Built in', description: 'Built-in description', supportedColorModes: ['light', 'invalid', 'light'] })
  skin(join(root, 'extensions/friend-client/skins/friend-light'), { description: 'Extension description' })
  prepare()
  const registry = readFileSync(join(client, 'src/components/storefront/themes/registry.generated.ts'), 'utf8')
  assert.match(registry, /"friend-light": \{"displayName":"Manifest label","description":"Extension description","extensionId":"friend","extensionName":"Friend","supportedColorModes":\["light"\]\}/)
  assert.match(registry, /"builtin-light": .*extensionId":"builtin"/)
  assert.match(registry, /"friend-light": \{ Layout: .*supportedColorModes: \["light"\] \}/)
  assert.match(registry, /"builtin-light": \{ Layout: .*supportedColorModes: \["light"\] \}/)
  for (const area of ['account', 'auth']) {
    const areaRegistry = readFileSync(join(client, `src/components/${area}/themes/registry.generated.ts`), 'utf8')
    assert.match(areaRegistry, /supportedColorModes: \["light"\]/)
  }
  prepare()
  assert.equal(readFileSync(join(client, 'src/components/storefront/themes/registry.generated.ts'), 'utf8'), registry)
}))
test('different extensions cannot claim the same skin ID', () => fixture(({ root, skin, prepare }) => {
  skin(join(root, 'extensions/first-client/skins/shared'))
  skin(join(root, 'extensions/second-client/skins/shared'))
  assert.throws(prepare, /contributed by both/)
}))
