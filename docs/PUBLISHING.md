# Nagless — Publishing Runbook

Everything needed to submit Nagless to addons.mozilla.org (AMO) and the Chrome Web Store (CWS). Listing texts below are final copy — paste verbatim.

## 1. Shared listing copy

- **Name:** `Nagless`
- **Summary** (≤ 132 chars, fits both stores):

  > Hides uninvited popups — newsletter nags, scroll overlays, timed interstitials. Unlocks scrolling. No lists, no data collection.

- **Description:**

  > Nagless hides the overlays nobody asked for: newsletter sign-up modals, "get email alerts" boxes, timed and scroll-triggered interstitials, and exit-intent popups. It also undoes the damage they cause — the page scroll they lock gets unlocked, and the email field they autofocus gets blurred, so on Android the keyboard stops popping up mid-article.
  >
  > It works without filter lists. Nagless watches for overlays that appear without you tapping anything and match a nag's behavioral fingerprint (fixed positioning, viewport coverage, backdrop, scroll-lock, signup fields). Modals you open yourself are never touched. Every block shows a brief "Popup blocked — Undo" chip, and a per-site switch turns Nagless off anywhere it guesses wrong.
  >
  > Privacy: Nagless collects nothing, sends nothing, and makes zero network requests. All settings stay in your browser.

- **Category:** AMO → "Privacy & Security"; CWS → "Tools" (fallback: "Productivity").
- **Privacy policy URL:** `https://github.com/muhannad85/nagless/blob/main/PRIVACY.md`
- **Support email:** muhannad.dev@gmail.com

## 2. Permission justification (both stores ask)

> Nagless detects nag overlays structurally on whatever page the user is reading, so it needs to run on all sites (`<all_urls>` content script + `storage` for settings). It makes no network requests, collects no data, and ships no remote code.

## 3. AMO (Firefox — desktop + Android)

1. Account: addons.mozilla.org → Developer Hub (free). The add-on ID `muhannad.dev@gmail.com` becomes permanently bound on first submission.
2. `npm run build` → submit `dist/nagless-firefox-1.0.0.zip` as a **listed** add-on.
3. Reviewer notes field: "No bundler or minification — the zip content is the literal source. Icons are PNGs rendered from assets/icon.svg in the repository. Zero network requests; `data_collection_permissions: none` declared in the manifest."
4. Android: `gecko_android` in the manifest makes AMO list it for Firefox for Android automatically. Verify the "Firefox for Android" compatibility checkbox is on.
5. Review: automated validation immediately; human review typically days. The listing goes live when approved.

## 4. Chrome Web Store (Chrome + Edge desktop users)

1. Account: Chrome Web Store Developer Dashboard — one-time **$5** registration fee.
2. New item → upload `dist/nagless-chrome-1.0.0.zip`.
3. **Privacy tab** (required):
   - Single purpose: "Hide nag/popup overlays on pages the user visits."
   - Host permission justification: §2 text.
   - Data collection: **none** (check no boxes; certify).
   - Privacy policy URL: §1.
4. Distribution: Public. Regions: all.
5. Expect extended (days-to-weeks) review because of `<all_urls>`. Do not resubmit while pending — it resets the queue.
6. Edge desktop users can install from CWS directly. A native Edge Add-ons listing (free, same zip) is optional post-launch.

## 5. Screenshot shot-list

Stores want 1280×800 (CWS) / any reasonable size (AMO). Take from fixtures via `npm run fixtures`:

1. `scroll-modal.html` with the nag visible (extension disabled) — "before".
2. Same page with nag gone + undo chip visible — "after".
3. The popup open on a normal site (toggles + counters).
4. (AMO, nice-to-have) Firefox for Android screenshot: fixture page with chip visible, popup bottom sheet.

## 6. Release procedure

1. Bump `version` in `manifest.firefox.json`, `manifest.chrome.json`, and `package.json` (keep all three identical).
2. Full gate: `npm ci && npm test && npm run lint && npm run e2e`.
3. `git tag v<version>` on the release commit; push with `--tags`.
4. `npm run build` → upload `dist/nagless-firefox-<version>.zip` to AMO, `dist/nagless-chrome-<version>.zip` to CWS.
5. Keep AMO and CWS versions identical; store listing text changes don't need a version bump.

## 7. Installing on a personal Android phone before store approval

- **Temporary (development):** `npm run start:android -- --adb-device <ID>` — see docs/IMPLEMENTATION.md Task 10 for phone setup (USB debugging + Firefox "Remote debugging via USB"; `adb reverse tcp:8907 tcp:8907` to reach the fixture server). The extension unloads when web-ext disconnects.
- **Permanent sideload:** `npm run sign` with AMO API credentials (Developer Hub → API keys) and `--channel unlisted` swapped in for a self-distributed signed `.xpi`, installable from file on Firefox for Android via Settings → About Firefox (tap logo 5×) → debug menu, or via a custom AMO collection. Use only if store review lag blocks personal use.

## 8. QA log

Append dated entries here after each manual QA pass (desktop + Android), listing real sites tested and block/miss/false-positive results.

### 2026-08-21 — automated QA sweep (Chromium via Playwright, extension loaded from dist/chrome)

- **Fixtures:** all 12 e2e tests green (8 nag patterns blocked incl. scroll-lock restore + focus blur; cookie banner and user-opened modal untouched; undo + pause verified; counters recorded).
- **Mobile emulation (375×812, touch):** scroll-modal, autofocus-email, timed-modal all blocked; chip rendered; `activeElement` returned to BODY (keyboard-dismiss case) — pending confirmation on real Firefox for Android hardware.
- **Real-site sweep** (homepage + one content page each, ~30s dwell with scrolling):
  - loveandlemons.com — **blocked a live newsletter popup** (`subscribe-popup-bg` + `subscribe-popup-positioner`); page scrollable after; no errors.
  - tasteofhome.com, forbes.com, countryliving.com — no popup shown to this fresh visitor; no leftover overlays (no misses), scrolling intact, no console errors attributable to Nagless.
- **Store assets:** `docs/store-assets/1-before-nag.png`, `2-after-blocked-chip.png`, `3-popup.png`, `4-android-style-chip.png`. Note: retake `3-popup.png` from a real toolbar popup over a normal site before submission (harness renders the popup as its own tab, so the per-site row shows as disabled).
- **Outstanding before submission:** desktop Firefox pass (`npm run start:firefox`), owner's Android-phone pass (IMPLEMENTATION.md Task 10 Step 4), listing screenshots final check.
