// Renders build/icon.svg to PNGs with Electron, so no extra image tools are needed.
// Usage: npm run icons
const { app, BrowserWindow } = require('electron')
const { copyFileSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')

const root = join(__dirname, '..')
const sizes = [16, 24, 32, 48, 64, 128, 256, 512]
const svg = readFileSync(join(root, 'build/icon.svg'), 'utf8')

// Draws the SVG onto a canvas per size (keeps transparency) and returns base64 PNGs.
const draw = (svgB64) => `new Promise((resolve, reject) => {
  const img = new Image()
  img.onerror = () => reject(new Error('could not load svg'))
  img.onload = () => resolve(${JSON.stringify(sizes)}.map((size) => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, size, size)
    return canvas.toDataURL('image/png').split(',')[1]
  }))
  img.src = 'data:image/svg+xml;base64,${svgB64}'
})`

app
  .whenReady()
  .then(async () => {
    const win = new BrowserWindow({ show: false })
    await win.loadURL('data:text/html,<html></html>')
    const pngs = await win.webContents.executeJavaScript(draw(Buffer.from(svg).toString('base64')))
    mkdirSync(join(root, 'build/icons'), { recursive: true })
    mkdirSync(join(root, 'resources'), { recursive: true })
    sizes.forEach((size, i) => {
      writeFileSync(join(root, `build/icons/${size}x${size}.png`), Buffer.from(pngs[i], 'base64'))
      console.log(`${size}x${size}`)
    })
    copyFileSync(join(root, 'build/icons/512x512.png'), join(root, 'build/icon.png'))
    copyFileSync(join(root, 'build/icons/256x256.png'), join(root, 'resources/icon.png'))
    // Tray icon; Electron picks the @2x file on HiDPI screens.
    copyFileSync(join(root, 'build/icons/32x32.png'), join(root, 'resources/tray.png'))
    copyFileSync(join(root, 'build/icons/64x64.png'), join(root, 'resources/tray@2x.png'))
  })
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => app.quit())
