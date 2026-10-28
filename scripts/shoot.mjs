// Launch the built app with Playwright and screenshot it at several window widths.
// Usage: npm run build && node scripts/shoot.mjs [outDir] [--dark]
import { mkdirSync } from 'node:fs'
import { _electron as electron } from 'playwright'

const outDir = process.argv.find((a, i) => i > 1 && !a.startsWith('--')) ?? '.ui-shots'
const dark = process.argv.includes('--dark')
const widths = [360, 414, 768, 1024, 1280]
mkdirSync(outDir, { recursive: true })

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const app = await electron.launch({ args: ['--ozone-platform=x11', '.'], env })
const page = await app.firstWindow()
await page.waitForLoadState('domcontentloaded')
if (dark) await page.emulateMedia({ colorScheme: 'dark' })

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
  const file = `${outDir}/${width}${dark ? '-dark' : ''}.png`
  await page.screenshot({ path: file })
  console.log(`${width}px → ${file}${overflow ? '  ⚠ horizontal overflow' : ''}`)
}

if (errors.length) console.log('console errors:\n' + errors.join('\n'))
await app.close()
