# Hub design notes

**Direction:** a launcher, not a card dashboard. Sites are recognised by their icons, so the
dashboard reads like GNOME's app grid: large icon + label, no card chrome. The primary action
(paste a URL to add a site) is always visible at the top. The sidebar is a slim graphite dock
that stays dark in both themes so the site next to it is the visual focus.

- **Palette:** bg `#f3f5f7` / dark `#16191d`, surface `#ffffff` / `#1e2227`, text `#1b1f24`,
  dock `#23282e`, accent jade `#0f7b6c` (dark `#3fb8a3`), danger `#c23b3b`.
- **Type:** IBM Plex Sans (400/500/600), bundled via @fontsource so it works offline.
  Scale 1.25: 13 / 16 / 20 / 25px.
- **Space:** 4px base. Radius 6 / 10 / 14 by elevation.
- **Motion:** 120ms micro, 200ms UI, `cubic-bezier(0.2, 0, 0, 1)`; reduced motion respected.
- Tokens live in `src/renderer/src/styles.css`.
