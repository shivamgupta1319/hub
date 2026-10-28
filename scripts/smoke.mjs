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

async function launch(extraEnv = {}) {
  const app = await electron.launch({
    args: ['--ozone-platform=x11', '.'],
    env: { ...env, ...extraEnv }
  })
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
// 1×1 PNG served as every page's favicon.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNg+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
)
const server = createServer((req, res) => {
  if (req.url === '/favicon.ico') {
    res.setHeader('content-type', 'image/png')
    return res.end(PNG)
  }
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

await page.waitForSelector('.site-grid img')
console.log('✓ saves the site’s favicon and shows it')

// Remove /two from the dashboard and check its session was wiped.
const { readFileSync } = await import('node:fs')
const sitesOnDisk = () => JSON.parse(readFileSync(join(profile, 'sites.json'), 'utf8')).sites
const two = sitesOnDisk().find((s) => s.url.endsWith('/two'))
await inSite('/two', "document.cookie = 'who=two; path=/'")
const cookiesFor = (siteId) =>
  app.evaluate(
    ({ session }, siteId) => session.fromPartition(`persist:site-${siteId}`).cookies.get({}),
    siteId
  )
assert.equal((await cookiesFor(two.id)).length, 1)
await page.click(`[aria-label="Edit ${two.name}"] >> nth=1`)
await page.click('dialog >> text=Remove…')
await page.click('dialog >> text=Remove site')
await page.waitForSelector('dialog', { state: 'detached' })
assert.equal((await cookiesFor(two.id)).length, 0)
assert.equal(sitesOnDisk().length, 2)
console.log('✓ removing a site deletes its cookies')

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

// --- Sleeping: idle pages close; keep-alive sites load at start and never sleep ---
const { writeFileSync } = await import('node:fs')
const sleepServer = createServer((req, res) => {
  res.setHeader('content-type', 'text/html')
  res.end(`<!doctype html><title>Sleep ${req.url}</title>`)
})
await new Promise((resolve) => sleepServer.listen(0, '127.0.0.1', resolve))
const sbase = `http://127.0.0.1:${sleepServer.address().port}`
const site = (id, path, keepAlive) => ({
  id,
  name: path.slice(1),
  url: `${sbase}${path}`,
  keepAlive,
  notifications: true,
  createdAt: 1
})
const sleepProfile = mkdtempSync(join(tmpdir(), 'hub-smoke-sleep-'))
writeFileSync(
  join(sleepProfile, 'sites.json'),
  JSON.stringify({ version: 1, sites: [site('a', '/chat', true), site('b', '/docs', false)] })
)
;({ app, page } = await launch({ HUB_USER_DATA: sleepProfile, HUB_SLEEP_AFTER_MS: '1500' }))
const loadedUrls = () =>
  app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].contentView.children.map((v) => v.webContents.getURL())
  )
await page.waitForSelector('.site-grid')
await new Promise((r) => setTimeout(r, 1500))
assert.deepEqual(await loadedUrls(), [`${sbase}/chat`])
console.log('✓ keep-alive sites load in the background at start')

await page.click('[aria-label="docs"]')
await new Promise((r) => setTimeout(r, 800))
await page.click('[aria-label="All sites"]')
await page.waitForSelector('[aria-label="docs (asleep)"]', { timeout: 10000 })
assert.deepEqual(await loadedUrls(), [`${sbase}/chat`])
console.log('✓ an idle site goes to sleep; the keep-alive site stays loaded')

await page.click('[aria-label="docs (asleep)"]')
await page.waitForSelector('[aria-label="docs"]')
for (let i = 0; i < 50 && !(await loadedUrls()).includes(`${sbase}/docs`); i++) {
  await new Promise((r) => setTimeout(r, 100))
}
assert.ok((await loadedUrls()).includes(`${sbase}/docs`))
console.log('✓ opening a sleeping site loads it again')
await app.close()
sleepServer.close()
