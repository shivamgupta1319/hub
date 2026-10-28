<p align="center"><img src="build/icons/128x128.png" width="96" height="96" alt=""></p>

# Hub

Keep the websites you use every day — mail, chat, calendars, project boards — in one
desktop app for Ubuntu. Add a site once, then switch between them from the sidebar.

## What it does

- **Dashboard** of your saved sites. Paste an address to add one; edit or remove it any time.
- **Sidebar** with every site's icon. One click switches; pages stay loaded in the background.
- **A separate login per site.** Each site has its own cookies, so you can add the same
  service twice with different accounts.
- **Links that leave the site open in your default browser.** Sign-in popups and the site's
  own pop-outs (like Gmail's compose window) stay inside Hub.
- **Real favicons**, a right-click menu in pages and on sidebar icons, and clear messages
  when a site can't load.

Planned next: putting idle sites to sleep to save memory, unread badges and notifications,
keyboard shortcuts with a quick switcher, a tray icon, start at login, and AppImage/.deb
packages.

## Run it

Requires Node.js 22+ on Linux.

```bash
npm install
npm run dev
```

Your sites are saved in `~/.config/hub/sites.json`.

## Develop

| Command             | What it does                                                   |
| ------------------- | -------------------------------------------------------------- |
| `npm run dev`       | Start the app with hot reload                                  |
| `npm run typecheck` | Type-check main, preload and renderer                          |
| `npm run lint`      | Lint everything                                                |
| `npm test`          | Unit tests (Vitest)                                            |
| `npm run smoke`     | Build, then drive the real app end to end with Playwright      |
| `npm run shoot`     | Build, then screenshot the app at 360–1280px into `.ui-shots/` |
| `npm run icons`     | Render `build/icon.svg` to the PNG icon sizes                  |

Built with Electron, React and TypeScript. Design notes live in [docs/design.md](docs/design.md).

## License

[MIT](LICENSE)
