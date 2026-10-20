const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

process.chdir(path.join(__dirname, '..'))
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'))
const manifest = readJson('manifest.json')
const pkg = readJson('package.json')
const lock = readJson('package-lock.json')
const archive = 'youtube-shorts-auto-scroll.zip'

assert.equal(manifest.manifest_version, 3, 'Expected a Manifest V3 extension')
assert.equal(manifest.version, pkg.version, 'Manifest and package versions must match')
assert.equal(lock.version, pkg.version, 'Lockfile and package versions must match')
assert.equal(lock.packages[''].version, pkg.version, 'Lockfile package version must match')
assert(manifest.default_locale, 'A default locale is required')

const requiredFiles = [
  'manifest.json',
  manifest.action.default_popup,
  ...Object.values(manifest.icons),
  ...Object.values(manifest.action.default_icon),
  ...manifest.content_scripts.flatMap(script => [...(script.js || []), ...(script.css || [])])
]
const popup = fs.readFileSync(manifest.action.default_popup, 'utf8')
for (const [, reference] of popup.matchAll(/(?:src|href)=["']([^"'#]+)["']/g)) {
  if (!/^[a-z]+:/i.test(reference)) {
    requiredFiles.push(path.join(path.dirname(manifest.action.default_popup), reference))
  }
}

const defaultMessages = readJson(`_locales/${manifest.default_locale}/messages.json`)
const keys = Object.keys(defaultMessages).sort()
for (const locale of fs.readdirSync('_locales', { withFileTypes: true }).filter(entry => entry.isDirectory())) {
  const file = `_locales/${locale.name}/messages.json`
  const messages = readJson(file)
  assert.deepEqual(Object.keys(messages).sort(), keys, `${locale.name}: message keys must match the default locale`)
  for (const key of keys) {
    assert.equal(typeof messages[key].message, 'string', `${locale.name}: ${key} must be text`)
    assert(messages[key].message.trim(), `${locale.name}: ${key} cannot be empty`)
    assert.deepEqual(
      Object.keys(messages[key].placeholders || {}).sort(),
      Object.keys(defaultMessages[key].placeholders || {}).sort(),
      `${locale.name}: ${key} placeholders must match`
    )
  }
  requiredFiles.push(file)
}
for (const [, key] of JSON.stringify(manifest).matchAll(/__MSG_(\w+)__/g)) {
  assert(defaultMessages[key], `Manifest message ${key} is missing`)
}
for (const file of requiredFiles) assert(fs.statSync(file).isFile(), `Missing package file: ${file}`)

if (process.argv.includes('--check')) {
  console.log(`Validated extension ${pkg.version}, referenced assets, and all locales.`)
} else {
  fs.rmSync(archive, { force: true })
  execFileSync('zip', ['-qr', archive, 'manifest.json', 'src/', 'assets/', '_locales/', '-x', '*.DS_Store', 'assets/images/demo.png'])
  const files = execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' }).trim().split('\n')
  for (const file of requiredFiles) assert(files.includes(file), `Package is missing ${file}`)
  assert(files.every(file => /^(manifest\.json$|src\/|assets\/|_locales\/)/.test(file)), 'Unexpected package contents')
  console.log(`Built ${archive} (${pkg.version}); verified ${files.length} archive entries.`)
}
