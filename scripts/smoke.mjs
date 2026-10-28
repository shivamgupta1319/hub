// End-to-end smoke test against the built app: add, validate, edit, remove, persist.
// Usage: npm run build && node scripts/smoke.mjs
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron } from 'playwright'

const profile = mkdtempSync(join(tmpdir(), 'hub-smoke-'))
const env = { ...process.env, HUB_USER_DATA: profile }
delete env.ELECTRON_RUN_AS_NODE

async function launch() {
  const app = await electron.launch({ args: ['--ozone-platform=x11', '.'], env })
  const page = await app.firstWindow()
  await page.waitForSelector('.dashboard')
  return { app, page }
}

let { app, page } = await launch()
const tiles = () => page.locator('.site-grid .tile-name').allInnerTexts()

await page.fill('.add-bar input', 'gmail')
await page.click('.add-bar button[type=submit]')
assert.match(await page.locator('.add-bar .field-error').innerText(), /full domain/)
console.log('✓ rejects an incomplete address')

await page.click('.chip:has-text("WhatsApp")')
await page.waitForFunction(
  () => globalThis.document.querySelectorAll('.site-grid .tile').length === 1
)
console.log('✓ quick-adds a suggestion')

await page.fill('.add-bar input', 'github.com')
await page.click('.add-bar button[type=submit]')
await page.waitForSelector('.site-grid')
assert.deepEqual(await tiles(), ['WhatsApp', 'Github'])
assert.equal(await page.inputValue('.add-bar input'), '')
console.log('✓ adds a site and clears the field')

await page.click('[aria-label="Edit Github"]')
await page.fill('dialog input >> nth=0', 'GitHub (work)')
await page.click('dialog button[type=submit]')
await page.waitForSelector('dialog', { state: 'detached' })
assert.deepEqual(await tiles(), ['WhatsApp', 'GitHub (work)'])
console.log('✓ edits a name')

await page.click('[aria-label="Edit WhatsApp"]')
await page.keyboard.press('Escape')
await page.waitForSelector('dialog', { state: 'detached' })
assert.equal(
  await page.evaluate(() => globalThis.document.activeElement?.getAttribute('aria-label')),
  'Edit WhatsApp'
)
console.log('✓ Escape closes the dialog and returns focus')

await page.click('[aria-label="Edit WhatsApp"]')
await page.click('dialog >> text=Remove…')
await page.click('dialog >> text=Remove site')
await page.waitForSelector('dialog', { state: 'detached' })
assert.deepEqual(await tiles(), ['GitHub (work)'])
console.log('✓ removes a site after confirming')

await app.close()
;({ app, page } = await launch())
await page.waitForSelector('.site-grid')
assert.deepEqual(await tiles(), ['GitHub (work)'])
console.log('✓ sites persist across restarts')
await app.close()
