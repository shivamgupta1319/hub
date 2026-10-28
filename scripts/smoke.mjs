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

// --- Site pages, served by a local server so the test needs no internet ---
const { createServer } = await import('node:http')
const server = createServer((req, res) => {
  res.setHeader('content-type', 'text/html')
  res.end(`<!doctype html><title>Page ${req.url}</title><h1>Hello from ${req.url}</h1>`)
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}`

;({ app, page } = await launch())
for (const path of ['/one', '/two']) {
  await page.fill('.add-bar input', base + path)
  await page.click('.add-bar button[type=submit]')
}
await page.waitForFunction(
  () => globalThis.document.querySelectorAll('.site-grid .tile').length === 3
)

/** Runs JS inside the site page whose URL ends with `path`. */
const inSite = (path, js) =>
  app.evaluate(
    async ({ webContents }, { path, js }) => {
      const wc = webContents.getAllWebContents().find((w) => w.getURL().endsWith(path))
      return wc ? wc.executeJavaScript(js) : undefined
    },
    { path, js }
  )
const visibleSiteUrls = () =>
  app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]
      .contentView.children.filter((v) => v.getVisible())
      .map((v) => v.webContents.getURL())
  )

await page.click(`.tile-main[title$="${base}/one"]`)
await new Promise((r) => setTimeout(r, 800))
assert.deepEqual(await visibleSiteUrls(), [`${base}/one`])
assert.equal(await inSite('/one', 'document.title'), 'Page /one')
console.log('✓ opens a site in its own page')

const ua = await inSite('/one', 'navigator.userAgent')
assert.doesNotMatch(ua, /Electron|hub\//)
console.log('✓ user agent looks like plain Chrome')

await inSite('/one', "document.cookie = 'who=one; path=/'; document.cookie")
await page.click(`.dock-list button >> nth=2`)
await new Promise((r) => setTimeout(r, 800))
assert.deepEqual(await visibleSiteUrls(), [`${base}/two`])
assert.equal(await inSite('/two', 'document.cookie'), '')
assert.equal(await inSite('/one', 'document.cookie'), 'who=one')
console.log('✓ switching via the sidebar shows only that site, and cookies stay separate')

await page.click('[aria-label="All sites"]')
await new Promise((r) => setTimeout(r, 300))
assert.deepEqual(await visibleSiteUrls(), [])
console.log('✓ Home hides every site page')

server.close()
await page.click(`.dock-list button >> nth=1`)
await inSite('/one', 'location.reload()').catch(() => {})
await page.waitForSelector('.stage-problem', { timeout: 10000 })
assert.deepEqual(await visibleSiteUrls(), [])
console.log('✓ a site that can’t be reached shows the problem panel instead of a blank page')

await page.click('.stage-problem >> text=Edit address')
await page.waitForSelector('dialog')
assert.deepEqual(await visibleSiteUrls(), [])
await page.keyboard.press('Escape')
console.log('✓ dialogs hide the site page while open')
await app.close()
