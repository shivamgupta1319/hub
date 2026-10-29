<p align="center"><img src="build/icons/128x128.png" width="96" height="96" alt=""></p>

# Hub

Keep the websites you use every day — mail, chat, calendars, project boards — in one
desktop app for Ubuntu. Add a site once, then switch between them from the sidebar.

## What it does

- **Dashboard** of your saved sites. Paste an address to add one; edit or remove it any time.
- **Sidebar** with every site's icon. One click switches; drag icons to reorder them.
- **A separate login per site.** Each site has its own cookies, so you can add the same
  service twice with different accounts. Removing a site signs you out of it.
- **Unread badges** read from page titles, and **notifications** you can turn off per site.
  Clicking a notification brings Hub forward on that site.
- **Sleeping sites.** Sites you haven't used for a while close to save memory and reload when
  you open them. Mark chat and mail as _Keep running in the background_ so they never sleep.
- **Tray icon** with your sites and unread counts. Closing the window keeps Hub running there,
  and Hub can start at login (both in Settings).
- Links that leave a site open in your default browser; sign-in popups stay inside Hub.

## Install

Download the `.deb` or AppImage from the [latest release](https://github.com/shivamgupta1319/hub/releases/latest), or build them with `npm run dist` (see [Build from source](#build-from-source)). Then:

- **.deb** (Ubuntu, Debian): `sudo apt install ./hub_0.1.1_amd64.deb`, then open Hub from the
  app grid.
- **AppImage**: `chmod +x Hub-0.1.1-x86_64.AppImage && ./Hub-0.1.1-x86_64.AppImage`. On
  Ubuntu 22.04+ AppImages need `sudo apt install libfuse2t64` (or `libfuse2` on 22.04).

On first launch the AppImage adds Hub to your app grid (in `~/.local/share/applications`),
which is also what gives it the Hub icon in the Ubuntu dock. The .deb installs this for you.

The tray icon uses AppIndicator, which Ubuntu enables by default. Your sites are saved in
`~/.config/hub/`.

## Keyboard shortcuts

Press <kbd>Alt</kbd> or click ☰ in the title bar to open the menu with all of them.

| Shortcut                                                      | Action                    |
| ------------------------------------------------------------- | ------------------------- |
| <kbd>Ctrl</kbd>+<kbd>1</kbd>…<kbd>9</kbd>                     | Open the first nine sites |
| <kbd>Ctrl</kbd>+<kbd>Tab</kbd> / +<kbd>Shift</kbd>            | Next / previous site      |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>K</kbd>                 | Go to a site by name      |
| <kbd>Alt</kbd>+<kbd>Home</kbd>                                | All sites (dashboard)     |
| <kbd>Alt</kbd>+<kbd>←</kbd> / <kbd>→</kbd>                    | Back / forward            |
| <kbd>Ctrl</kbd>+<kbd>R</kbd>                                  | Reload the site           |
| <kbd>Ctrl</kbd>+<kbd>+</kbd> / <kbd>-</kbd> / <kbd>0</kbd>    | Zoom in / out / reset     |
| <kbd>Ctrl</kbd>+<kbd>N</kbd> (or <kbd>+</kbd> in the sidebar) | Add a site                |
| <kbd>Ctrl</kbd>+<kbd>,</kbd>                                  | Settings                  |

<kbd>Ctrl</kbd>+<kbd>K</kbd> is left to the sites themselves (Slack, GitHub and Notion use it).

## Build from source

Requires Node.js 22+ on Linux.

```bash
npm install
npm run dev     # run with hot reload
npm run dist    # build dist/Hub-<version>-x86_64.AppImage and dist/hub_<version>_amd64.deb
```

## Develop

| Command              | What it does                                                   |
| -------------------- | -------------------------------------------------------------- |
| `npm run dev`        | Start the app with hot reload                                  |
| `npm run typecheck`  | Type-check main, preload and renderer                          |
| `npm run lint`       | Lint everything                                                |
| `npm test`           | Unit tests (Vitest)                                            |
| `npm run smoke`      | Build, then drive the real app end to end with Playwright      |
| `npm run smoke:dist` | Same, against the packaged app in `dist/linux-unpacked`        |
| `npm run dist`       | Build the AppImage and .deb into `dist/`                       |
| `npm run shoot`      | Build, then screenshot the app at 360–1280px into `.ui-shots/` |
| `npm run icons`      | Render `build/icon.svg` to the PNG icon sizes                  |

Built with Electron, React and TypeScript. Design notes live in [docs/design.md](docs/design.md).

## License

[MIT](LICENSE)
