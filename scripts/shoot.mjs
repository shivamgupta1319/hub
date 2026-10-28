// Launch the built app with Playwright and screenshot it at several window widths.
// Usage: npm run build && node scripts/shoot.mjs [outDir] [--dark]
//   SHOOT_SEED=path/to/sites.json  start with these saved sites
//   SHOOT_CLICK=<css selector>     click this before capturing (e.g. to open a dialog)
import { copyFileSync, mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron } from 'playwright'

const outDir = process.argv.find((a, i) => i > 1 && !a.startsWith('--')) ?? '.ui-shots'
const dark = process.argv.includes('--dark')
const widths = [360, 414, 768, 1024, 1280]
mkdirSync(outDir, { recursive: true })

// A throwaway profile so screenshots never touch real saved sites or logins.
const profile = mkdtempSync(join(tmpdir(), 'hub-shoot-'))
if (process.env.SHOOT_SEED) copyFileSync(process.env.SHOOT_SEED, join(profile, 'sites.json'))
// Temp XDG config so 'Start at login' never touches the real ~/.config/autostart.
const env = {
  ...process.env,
  HUB_USER_DATA: profile,
  XDG_CONFIG_HOME: mkdtempSync(join(tmpdir(), 'hub-shoot-xdg-')),
  XDG_DATA_HOME: mkdtempSync(join(tmpdir(), 'hub-shoot-data-'))
}
delete env.ELECTRON_RUN_AS_NODE
const app = await electron.launch({ args: ['--ozone-platform=x11', '.'], env })
const page = await app.firstWindow()
await page.waitForLoadState('domcontentloaded')
if (dark) await page.emulateMedia({ colorScheme: 'dark' })
await page.waitForSelector('.dashboard')
if (process.env.SHOOT_CLICK) await page.click(process.env.SHOOT_CLICK)
const suffix = process.env.SHOOT_CLICK ? '-click' : ''

const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

for (const width of widths) {
  await app.evaluate(({ BrowserWindow }, w) => {
    const [win] = BrowserWindow.getAllWindows()
    win.setContentSize(w, 760)
  }, width)
  await page.waitForTimeout(250)
  const overflow = await page.evaluate(
    () => globalThis.document.documentElement.scrollWidth > globalThis.innerWidth
  )
  const file = `${outDir}/${width}${dark ? '-dark' : ''}${suffix}.png`
  await page.screenshot({ path: file })
  console.log(`${width}px → ${file}${overflow ? '  ⚠ horizontal overflow' : ''}`)
}

if (errors.length) console.log('console errors:\n' + errors.join('\n'))
await app.close()
