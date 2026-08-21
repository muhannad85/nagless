# Nagless — popup & nag blocker

Nagless hides the overlays nobody asked for: newsletter sign-up modals, "get email alerts" nags, timed and scroll-triggered interstitials. It unlocks the page scroll they hijack and dismisses the mobile keyboard that their autofocused email fields pop open — the single most annoying variant on Firefox for Android.

**Status:** in development, pre-release. Not yet on the stores.

## How it works

No filter lists, no network requests, no data collection. Nagless watches for overlays that appear *without you interacting* (scroll-, time-, and exit-triggered) and match a modal's behavioral fingerprint — fixed position, viewport coverage, backdrop, scroll-lock, signup fields. Matches are hidden (never deleted), the scroll-lock is undone, and a small **"Popup blocked — Undo"** chip appears for a few seconds in case Nagless got it wrong. Modals you open yourself are left alone.

Full behavior specification: [docs/SPEC.md](docs/SPEC.md).

## Platforms

| Platform | Support |
|---|---|
| Firefox for Android | ✅ primary target (via addons.mozilla.org) |
| Firefox desktop | ✅ |
| Chrome desktop | ✅ (via Chrome Web Store) |
| Edge desktop | ✅ (installs from Chrome Web Store) |
| Chrome/Edge on Android | ❌ those browsers don't support extensions |

Manifest V3 across the board. Minimum: Firefox 121, Chrome 121.

## Controls

- Global on/off toggle
- Per-site off switch (allowlist)
- Blocked counters (this page / all time), toolbar badge on desktop
- Undo chip after every block

## Development

Requires Node ≥ 20. No runtime dependencies; dev tooling is `web-ext` and Playwright.

```bash
npm install
npm run build          # assembles dist/firefox and dist/chrome + zips
npm test               # unit tests (node --test)
npm run e2e            # Playwright smoke tests against local fixtures (Chromium)
npm run start:firefox  # desktop Firefox with the extension loaded
npm run start:android  # release Firefox for Android over USB (adb required)
npm run lint           # web-ext lint on the Firefox build
```

Chrome: load `dist/chrome` unpacked via `chrome://extensions` (Developer mode).

## Project documentation

- [docs/SPEC.md](docs/SPEC.md) — design specification (scope, detection engine, UI, platforms)
- `docs/IMPLEMENTATION.md` — phased implementation plan *(written next, after spec review)*
- `docs/PUBLISHING.md` — AMO / Chrome Web Store submission runbook *(written during the publishing phase)*
- [PRIVACY.md](PRIVACY.md) — privacy statement: Nagless collects nothing

## License

MIT
