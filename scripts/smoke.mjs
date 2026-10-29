// End-to-end smoke test against the built app: add, validate, edit, remove, persist.
// Usage: npm run smoke   (or `npm run dist && npm run smoke:dist` for the packaged app)
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron } from 'playwright'

const profile = mkdtempSync(join(tmpdir(), 'hub-smoke-'))
// A temp XDG config dir keeps 'Start at login' from touching the real ~/.config/autostart.
const xdgConfig = mkdtempSync(join(tmpdir(), 'hub-smoke-xdg-'))
// …and a temp XDG data dir keeps the dock launcher entry out of the real ~/.local/share.
const xdgData = mkdtempSync(join(tmpdir(), 'hub-smoke-data-'))
const env = {
  ...process.env,
  HUB_USER_DATA: profile,
  XDG_CONFIG_HOME: xdgConfig,
  XDG_DATA_HOME: xdgData
}
delete env.ELECTRON_RUN_AS_NODE

async function launch(extraEnv = {}) {
  // SMOKE_EXECUTABLE tests a packaged build (e.g. dist/linux-unpacked/hub) instead of dev.
  const executablePath = process.env.SMOKE_EXECUTABLE
  const app = await electron.launch({
    ...(executablePath ? { executablePath } : {}),
    args: executablePath ? ['--ozone-platform=x11'] : ['--ozone-platform=x11', '.'],
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
await page.waitForFunction(
  () => globalThis.document.querySelectorAll('.site-grid .tile').length === 2
)
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

assert.equal(await inSite('/one', 'typeof PublicKeyCredential'), 'undefined')
assert.equal(
  await inSite(
    '/one',
    'navigator.credentials.get({ publicKey: { challenge: new Uint8Array(8) } }).then(() => "ok", (e) => e.name)'
  ),
  'NotAllowedError'
)
console.log('✓ passkey requests fail at once instead of hanging, so sign-in offers other methods')

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

// --- Badges and notifications ---
const inSleepSite = (path, js) =>
  app.evaluate(
    async ({ webContents }, { path, js }) => {
      const wc = webContents.getAllWebContents().find((w) => w.getURL().endsWith(path))
      return wc ? wc.executeJavaScript(js) : undefined
    },
    { path, js }
  )
await inSleepSite('/chat', "document.title = '(3) Chat'")
await page.waitForSelector('[aria-label="chat, 3 unread"] .dock-badge')
assert.equal(await page.innerText('[aria-label="chat, 3 unread"] .dock-badge'), '3')
await inSleepSite('/chat', "document.title = 'Chat'")
await page.waitForSelector('[aria-label="chat"]')
console.log('✓ unread counts from the page title show on the sidebar icon')

assert.equal(await inSleepSite('/chat', 'Notification.permission'), 'granted')
await page.click('[aria-label="All sites"]')
await page.click('[aria-label="Edit chat"]')
await page.click('dialog >> text=Show notifications')
await page.click('dialog button[type=submit]')
await page.waitForSelector('dialog', { state: 'detached' })
assert.equal(await inSleepSite('/chat', 'Notification.permission'), 'denied')
console.log('✓ notifications can be turned off per site')

await page.click('[aria-label="All sites"]')
await inSleepSite('/chat', 'window.__hubFocusSite()')
await page.waitForSelector('[aria-label="chat"][aria-current="page"]')
console.log('✓ clicking a site’s notification brings that site forward')

// --- Shortcuts, quick switcher and reordering ---
// Playwright's key presses go straight to the page and skip native menu accelerators, so this
// triggers the menu item bound to each shortcut instead.
const shortcut = (accelerator) =>
  app.evaluate(({ Menu }, accelerator) => {
    const find = (items) => {
      for (const item of items) {
        if (item.accelerator === accelerator) return item
        const inner = item.submenu && find(item.submenu.items)
        if (inner) return inner
      }
    }
    const item = find(Menu.getApplicationMenu().items)
    if (!item) throw new Error(`no menu item for ${accelerator}`)
    item.click()
  }, accelerator)
await page.click('[aria-label="All sites"]')
await shortcut('CmdOrCtrl+Shift+K')
await page.waitForSelector('dialog[aria-label="Go to site"]')
await page.keyboard.type('do')
await page.keyboard.press('Enter')
await page.waitForSelector('dialog', { state: 'detached' })
await page.waitForSelector('[aria-label="docs"][aria-current="page"]')
console.log('✓ Ctrl+Shift+K opens the quick switcher; typing and Enter open a site')

await shortcut('CmdOrCtrl+1')
await page.waitForSelector('[aria-label="chat"][aria-current="page"]')
await shortcut('Ctrl+Tab')
await page.waitForSelector('[aria-label="docs"][aria-current="page"]')
await shortcut('Alt+Home')
await page.waitForSelector('[aria-label="All sites"][aria-current="page"]')
console.log('✓ Ctrl+1, Ctrl+Tab and Alt+Home switch sites')

await page.dragAndDrop('.dock-list li:nth-child(2)', '.dock-list li:nth-child(1)', {
  targetPosition: { x: 20, y: 4 }
})
await page.waitForFunction(
  () =>
    globalThis.document.querySelector('.dock-list li button')?.getAttribute('aria-label') === 'docs'
)
const orderOnDisk = JSON.parse(
  (await import('node:fs')).readFileSync(join(sleepProfile, 'sites.json'), 'utf8')
).sites.map((s) => s.name)
assert.deepEqual(orderOnDisk, ['docs', 'chat'])
await shortcut('CmdOrCtrl+1')
await page.waitForSelector('[aria-label="docs"][aria-current="page"]')
console.log('✓ dragging an icon reorders the sidebar, and Ctrl+1 follows the new order')

// Real key presses this time (Playwright's skip Electron's input hooks): SiteManager handles the
// zoom keys itself, not through the menu.
const docsZoom = () =>
  app.evaluate(({ webContents }, url) => {
    return webContents
      .getAllWebContents()
      .find((w) => w.getURL() === url)
      ?.getZoomLevel()
  }, `${sbase}/docs`)
const zoomTo = async (keyCode, modifiers, level) => {
  await app.evaluate(
    ({ BrowserWindow }, { keyCode, modifiers }) => {
      const wc = BrowserWindow.getAllWindows()[0].webContents
      wc.sendInputEvent({ type: 'keyDown', keyCode, modifiers })
      wc.sendInputEvent({ type: 'keyUp', keyCode, modifiers })
    },
    { keyCode, modifiers }
  )
  for (let i = 0; i < 30 && (await docsZoom()) !== level; i++) {
    await new Promise((r) => setTimeout(r, 100))
  }
  assert.equal(await docsZoom(), level, `${modifiers.join('+')}+${keyCode}`)
}
await zoomTo('=', ['control'], 0.5)
await zoomTo('Plus', ['control', 'shift'], 1)
await zoomTo('numadd', ['control'], 1.5)
await zoomTo('-', ['control'], 1)
await zoomTo('numsub', ['control'], 0.5)
await zoomTo('0', ['control'], 0)
console.log('✓ Ctrl with + / = / - / 0, on the main keys or the number pad, zooms the site')

await page.click('[aria-label="Add a site"]')
await page.waitForSelector('dialog[aria-label="Add a site"]')
assert.deepEqual(await visibleSiteUrls(), [])
await page.keyboard.type(`${sbase}/mail`)
await page.keyboard.press('Enter')
await page.waitForSelector('dialog', { state: 'detached' })
await page.waitForSelector('.dock-list li:nth-child(3) button[aria-current="page"]')
for (let i = 0; i < 50 && (await visibleSiteUrls())[0] !== `${sbase}/mail`; i++) {
  await new Promise((r) => setTimeout(r, 100))
}
assert.deepEqual(await visibleSiteUrls(), [`${sbase}/mail`])
console.log('✓ the sidebar’s + adds a site without leaving the current one, then opens it')

// The title bar replaces the menu bar: pages start below it, real shortcuts still reach the
// hidden menu, and ☰ or a tap on Alt opens the menu.
const siteTop = await app.evaluate(
  ({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]
      .contentView.children.find((v) => v.getVisible())
      ?.getBounds().y
)
assert.equal(siteTop, 36)
await app.evaluate(({ BrowserWindow }) => {
  // Typed into the open site's page, where focus is after opening it.
  const wc = BrowserWindow.getAllWindows()[0].contentView.children.find((v) =>
    v.getVisible()
  ).webContents
  wc.sendInputEvent({ type: 'keyDown', keyCode: 'K', modifiers: ['control', 'shift'] })
  wc.sendInputEvent({ type: 'keyUp', keyCode: 'K', modifiers: ['control', 'shift'] })
})
await page.waitForSelector('dialog[aria-label="Go to site"]')
await page.keyboard.press('Escape')
await page.waitForSelector('dialog', { state: 'detached' })
await app.evaluate(({ Menu }) => {
  globalThis.__menuOpens = 0
  Menu.getApplicationMenu().popup = () => globalThis.__menuOpens++
})
await page.click('[aria-label="Menu"]')
await app.evaluate(({ BrowserWindow }) => {
  const wc = BrowserWindow.getAllWindows()[0].contentView.children.find((v) =>
    v.getVisible()
  ).webContents
  wc.sendInputEvent({ type: 'keyDown', keyCode: 'Alt' })
  wc.sendInputEvent({ type: 'keyUp', keyCode: 'Alt' })
})
for (let i = 0; i < 30 && (await app.evaluate(() => globalThis.__menuOpens)) < 2; i++) {
  await new Promise((r) => setTimeout(r, 100))
}
assert.equal(await app.evaluate(() => globalThis.__menuOpens), 2)
console.log(
  '✓ the title bar’s ☰ and a tap on Alt open the menu; shortcuts work without a menu bar'
)

// --- Settings and close to tray ---
const { existsSync } = await import('node:fs')
assert.match(
  readFileSync(join(xdgData, 'applications', 'hub.desktop'), 'utf8'),
  /StartupWMClass=hub/
)
assert.ok(existsSync(join(xdgData, 'icons/hicolor/scalable/apps/hub.svg')))
console.log('✓ installs a launcher entry and icon so the dock shows Hub’s icon')
await shortcut('Alt+Home')
await page.click('[aria-label="Settings"]')
await page.waitForSelector('dialog[aria-label="Settings"] select')
await page.selectOption('dialog select', '0')
for (let i = 0; i < 50; i++) {
  const saved = existsSync(join(sleepProfile, 'settings.json'))
    ? JSON.parse(readFileSync(join(sleepProfile, 'settings.json'), 'utf8'))
    : {}
  if (saved.sleepAfterMinutes === 0) break
  await new Promise((r) => setTimeout(r, 100))
}
assert.equal(
  JSON.parse(readFileSync(join(sleepProfile, 'settings.json'), 'utf8')).sleepAfterMinutes,
  0
)
const autostartFile = join(xdgConfig, 'autostart', 'hub.desktop')
await page.click('dialog >> text=Start Hub when I log in')
for (let i = 0; i < 50 && !existsSync(autostartFile); i++) {
  await new Promise((r) => setTimeout(r, 100))
}
assert.match(readFileSync(autostartFile, 'utf8'), /^Exec=.* --hidden$/m)
await page.click('dialog >> text=Start Hub when I log in')
for (let i = 0; i < 50 && existsSync(autostartFile); i++) {
  await new Promise((r) => setTimeout(r, 100))
}
assert.equal(existsSync(autostartFile), false)
await page.click('dialog >> text=Done')
console.log('✓ settings save, and “Start Hub when I log in” adds and removes the autostart entry')

await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close())
await new Promise((r) => setTimeout(r, 500))
assert.equal(
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()),
  false
)
console.log('✓ closing the window keeps Hub running in the tray')

await app.close()
sleepServer.close()
