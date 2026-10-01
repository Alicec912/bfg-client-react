import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, copyFileSync, symlinkSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'bfg-plugin-assets-'))
  const host = join(root, 'client')
  mkdirSync(join(host, 'scripts'), { recursive: true })
  copyFileSync(new URL('./prepare.js', import.meta.url), join(host, 'scripts/prepare.js'))
  const plugin = id => {
    const path = join(host, 'src/plugins', id)
    mkdirSync(join(path, 'public/media'), { recursive: true })
    writeFileSync(join(path, 'index.ts'), 'export default { id: "fixture" }')
    return path
  }
  const prepare = () => execFileSync(process.execPath, [join(host, 'scripts/prepare.js')], { stdio: 'pipe' })
  try { run({ root, host, plugin, prepare }) } finally { rmSync(root, { recursive: true, force: true }) }
}

test('public assets retain stable mount URLs and stale owned files are cleaned on uninstall', () => fixture(({ host, plugin, prepare }) => {
  const source = plugin('one')
  writeFileSync(join(source, 'public/media/photo.txt'), 'photo')
  writeFileSync(join(source, 'public-mounts.json'), JSON.stringify([{ source: '/gallery', directory: 'media' }]))
  mkdirSync(join(host, 'public/gallery'), { recursive: true })
  writeFileSync(join(host, 'public/gallery/photo.txt'), 'host photo')
  prepare()
  assert.equal(readFileSync(join(host, 'public/gallery/photo.txt'), 'utf8'), 'host photo')
  assert.equal(readFileSync(join(host, 'public/plugins/one/media/photo.txt'), 'utf8'), 'photo')
  assert.deepEqual(JSON.parse(readFileSync(join(host, 'src/.plugin-public-mounts.json'), 'utf8')), [{ source: '/gallery/:path*', destination: '/plugins/one/media/:path*' }])
  prepare()
  rmSync(source, { recursive: true })
  prepare()
  assert.equal(existsSync(join(host, 'public/plugins/one/media/photo.txt')), false)
}))

test('mount collisions and reserved paths fail before deleting earlier outputs', () => fixture(({ host, plugin, prepare }) => {
  const one = plugin('one')
  writeFileSync(join(one, 'public/media/first.txt'), 'first')
  writeFileSync(join(one, 'public-mounts.json'), JSON.stringify([{ source: '/gallery', directory: 'media' }]))
  prepare()
  const two = plugin('two')
  writeFileSync(join(two, 'public-mounts.json'), JSON.stringify([{ source: '/gallery', directory: 'media' }]))
  assert.throws(prepare, /mount collision/)
  assert.equal(readFileSync(join(host, 'public/plugins/one/media/first.txt'), 'utf8'), 'first')
  writeFileSync(join(two, 'public-mounts.json'), JSON.stringify([{ source: '/api/files', directory: 'media' }]))
  assert.throws(prepare, /reserved plugin public mount/)
  writeFileSync(join(two, 'public-mounts.json'), JSON.stringify([{ source: '/product', directory: 'media' }]))
  assert.throws(prepare, /reserved plugin public mount/)
}))

test('public sync refuses host overwrite and modified generated files', () => fixture(({ host, plugin, prepare }) => {
  const source = plugin('one')
  writeFileSync(join(source, 'public/media/photo.txt'), 'source')
  mkdirSync(join(host, 'public/plugins/one/media'), { recursive: true })
  writeFileSync(join(host, 'public/plugins/one/media/photo.txt'), 'host')
  assert.throws(prepare, /overwrite a host file/)
  rmSync(join(host, 'public/plugins/one/media/photo.txt'))
  prepare()
  writeFileSync(join(host, 'public/plugins/one/media/photo.txt'), 'manual edit')
  assert.throws(prepare, /was modified/)
  assert.equal(readFileSync(join(host, 'public/plugins/one/media/photo.txt'), 'utf8'), 'manual edit')
}))

test('source links, dangling destination links and traversal ownership records are rejected', () => fixture(({ root, host, plugin, prepare }) => {
  const source = plugin('one')
  writeFileSync(join(source, 'public/media/photo.txt'), 'source')
  symlinkSync(join(root, 'missing'), join(source, 'public/media/link.txt'))
  assert.throws(prepare, /cannot contain symlinks/)
  rmSync(join(source, 'public/media/link.txt'))
  mkdirSync(join(host, 'public/plugins/one/media'), { recursive: true })
  symlinkSync(join(root, 'missing'), join(host, 'public/plugins/one/media/photo.txt'))
  assert.throws(prepare, /crosses a symlink/)
  rmSync(join(host, 'public/plugins/one/media/photo.txt'))
  writeFileSync(join(host, 'src/.plugin-public-assets.json'), JSON.stringify({ files: [{ path: '../outside', owner: 'one', sha256: 'a'.repeat(64) }] }))
  assert.throws(prepare, /ownership path/)
  assert.equal(existsSync(join(root, 'outside')), false)
}))

test('server-only loaders are separate from shared plugin loaders', () => fixture(({ host, plugin, prepare }) => {
  const source = plugin('one')
  writeFileSync(join(source, 'storefront-server.ts'), 'export default { matches: () => true }')
  prepare()
  const shared = readFileSync(join(host, 'src/plugins/loaders.generated.ts'), 'utf8')
  const server = readFileSync(join(host, 'src/plugins/storefront-server.generated.ts'), 'utf8')
  assert.doesNotMatch(shared, /storefront-server/)
  assert.match(server, /plugins\/one\/storefront-server/)
  assert.match(server, /import 'server-only'/)
}))
