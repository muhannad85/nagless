# Nagless — Design Specification

- **Status:** Approved design, pre-implementation
- **Date:** 2026-08-21
- **Owner:** Muhannad Asfour
- **Working artifact:** this document is the source of truth for v1 scope and behavior. The build plan lives in [IMPLEMENTATION.md](IMPLEMENTATION.md).

## 1. Problem

Modern websites interrupt reading with *uninvited* overlays: newsletter sign-up modals, "get email alerts" nags, timed or scroll-triggered interstitials, and exit-intent popups. On mobile they are worse: many autofocus an email field, which pops the software keyboard mid-scroll. Existing ad blockers focus on network-level ads; these nags are first-party DOM elements they often miss.

**Nagless** is a Manifest V3 browser extension that detects and hides uninvited overlays, restores page scrolling, and dismisses the keyboard — with an undo affordance so false positives cost one tap.

## 2. Product decisions (settled)

| Decision | Choice |
|---|---|
| Detection strategy | Behavioral heuristics with interaction gating. No filter lists in v1 (seam left for v2). |
| False-positive safety | Hide (never delete) + in-page "Popup blocked — Undo" chip + toolbar badge + per-site off switch. |
| Name | **Nagless** (store listing style: "Nagless — popup & nag blocker"). Collision-checked against AMO/CWS 2026-08-21. |
| Add-on ID (Firefox) | `muhannad.dev@gmail.com` (email-format identifier, doubles as the contact address) — permanent once first submitted to AMO. |
| Runtime dependencies | None. Vanilla JS, no bundler, no frameworks. |
| Data collection | None. No analytics, no network requests of any kind. |

## 3. Scope

### 3.1 Blocks (v1)

- Scroll-triggered, timed, and exit-intent modal overlays (newsletter/signup/promo/app-install nags).
- The dimmed backdrop that accompanies them.
- The page scroll-lock they impose (`overflow:hidden` and `body{position:fixed}` variants), with scroll position restored.
- The autofocused input inside a blocked overlay: focus is blurred so the mobile keyboard dismisses/never appears.
- Full-sheet cookie/consent walls **when they match the same behavioral profile** (uninvited + overlay + lock/backdrop). Small non-blocking banners are left alone. Per-site switch is the escape hatch for sites that gate content on consent.

### 3.2 Never touches

- Overlays appearing within ~1s after a user gesture (tap/click/keypress) — lightboxes, login modals, menus, search overlays the user asked for.
- Elements smaller than the size gates (§5.3) — inline banners, toasts, chat bubbles.
- Anything when the site is allowlisted or the global toggle is off.

### 3.3 Non-goals (v1)

- Ad blocking or any network-level blocking.
- Filter/cosmetic lists (EasyList, Fanboy). The scoring module is the seam where list-derived rules could plug in later.
- Overlays rendered entirely inside cross-origin iframes (content script runs top-frame only; rare for this nag class).
- Safari, i18n (English only), settings sync across devices (uses `storage.local`), per-element picker.

## 4. Platform matrix

| Platform | Support | Channel |
|---|---|---|
| Firefox for Android | **Primary target** | addons.mozilla.org (AMO) |
| Firefox desktop | Full | AMO |
| Chrome desktop | Full | Chrome Web Store (CWS) |
| Edge desktop | Full | Installs from CWS; dedicated Edge Add-ons listing is a post-v1 option |
| Chrome/Edge on Android | Impossible — no extension support | — |

Minimum versions: Firefox 121 (`gecko` and `gecko_android` `strict_min_version: "121.0"`), Chrome 121 (`minimum_chrome_version`). Rationale: 121 is where both browsers cleanly tolerate the dual `background` key (§8).

## 5. Detection engine

Lives in the content script. Three cooperating parts: interaction gating, candidate discovery, and overlay scoring. All numeric constants live in one tunable block in `src/common/scoring.js`.

### 5.1 Interaction gating

- Capture-phase, passive listeners on `window` record `lastGestureTs` for: `click` (anywhere) and `keydown` on interactive targets (links, buttons, form fields, `[tabindex]`, contenteditable). Deliberately **not** `pointerdown`/`touchstart`/`wheel`: touch-scrolling begins with `touchstart` and desktop scrolling with wheel/keys, and scrolling must never count as an invitation — scroll-triggered popups are the primary target.
- An overlay is **uninvited** iff it appeared (was inserted, or became visible via class/style change) more than `GESTURE_WINDOW_MS = 1000` after `lastGestureTs`.
- Uninvited is a **hard gate**: invited overlays are never evaluated further. This is the primary false-positive defense.

### 5.2 Candidate discovery

- One `MutationObserver` on `document.documentElement`: `childList + subtree`, plus `attributes` filtered to `style`, `class`.
- Mutations are queued and processed in a single `requestAnimationFrame` batch (deduped). No full-document rescans, no polling intervals.
- Candidates per batch: added element subtree roots, and existing elements whose `class`/`style` changed (covers the display-toggle pattern where the modal is in the DOM from page load and un-hidden later).
- Within an added subtree, fixed/sticky descendants are found with a bounded traversal (depth- and count-limited) with early exits; `getComputedStyle` is called only on shortlisted elements.
- One initial scan at `document_idle` catches overlays already present at injection time. Elements present at that moment are flagged `preexisting` and additionally require dialog semantics or a nag keyword to be blockable — page furniture (app shells, maps, editors) must never match on shape alone.
- Perf budget: no scanning long task > 50 ms on pages with 10k+ DOM nodes (verified on fixtures).

### 5.3 Overlay test — hard gates (all required)

| Gate | Requirement |
|---|---|
| G1 Uninvited | §5.1 |
| G2 Overlay positioning | Computed `position: fixed` or `sticky` |
| G3 Size | Covers ≥ 25% of viewport area, **or** is a sheet: width ≥ 90% of viewport width and height ≥ 20% of viewport height, **or** covers ≥ 8% while accompanied by a backdrop, a scroll-lock, or dialog semantics (a modest centered card with any of those still intercepts the whole page) |
| G4 Visible | Rendered (`display` ≠ `none`, `visibility: visible`, opacity > 0.05) and intersects the viewport |
| G5 Foreign | Not Nagless UI, not already processed |

### 5.4 Overlay test — soft signals (block iff score ≥ `SCORE_THRESHOLD = 3`)

| Signal | Weight |
|---|---|
| Scroll-lock applied to `html`/`body` within ±2s of appearance | +2 |
| Dialog semantics: `role="dialog"`, `aria-modal="true"`, or `<dialog open>` | +2 |
| Backdrop present: ancestor/sibling covering ≥ 95% viewport with non-transparent background or `backdrop-filter` | +2 |
| Contains a text/email input, or an input was autofocused at appearance | +2 |
| `z-index` ≥ 1000 | +1 |
| Nag keywords in `id`/`class` of element or direct descendants (`newsletter`, `subscribe`, `signup`, `modal`, `popup`, `overlay`, `interstitial`, …) | +1 |
| Near-fullscreen: covers ≥ 80% viewport area | +1 |

A standalone uninvited dimmer (backdrop + scroll-lock, no visible content) also reaches threshold by construction and is blocked.

### 5.5 Block action

A **block event** groups: the overlay element(s), any associated backdrop, and the scroll-lock state change. Per event:

1. Hide each element with inline `display: none !important` (via `style.setProperty(..., 'important')`), after recording the prior inline `display` value and tagging with `data-nagless-id`.
2. If `document.activeElement` is inside a hidden element: `blur()` it (dismisses the Android keyboard).
3. Undo the scroll-lock: restore recorded prior inline `overflow`/`overflow-y` on `html`/`body`; for the `body{position:fixed; top:-Npx}` pattern, restore position and `scrollTo` the recorded offset.
4. Watch (via the existing attribute observer) for the site re-asserting the lock for `REASSERT_WINDOW_MS = 3000`; re-unlock, bounded.
5. Report the event to the background (badge/counters, §7) and show the undo chip (§6).

Caps against pathological sites: max `10` block events per page load; per element-signature, after `3` re-blocks the element stays hidden silently (no new chip, no counter spam).

### 5.6 Runtime state & reactivity

- On injection, the content script reads `{enabled, allowlist}` from `storage.local`; it exits early when disabled or the (normalized, §7.2) hostname is allowlisted.
- It subscribes to `storage.onChanged`: flipping the global toggle or the site toggle takes effect live in open tabs — disabling stops observation and restores everything hidden this page-load; enabling re-arms.

## 6. Undo chip

- Rendered in an **open shadow root** on a host `<div>` appended to `<html>` (not `<body>`, which sites replace), all styles inline in the shadow — site CSS cannot affect it and no `web_accessible_resources` are needed. (Open, not closed: closed mode only hides `host.shadowRoot` from page JS while the host node stays deletable either way, and it would break test automation and debuggability.)
- Appearance: small dark pill, bottom-center, `position: fixed`, max z-index (2147483647), respects `env(safe-area-inset-bottom)`, honors `prefers-color-scheme`. Text: `Popup blocked` + `Undo` button. Touch target ≥ 44px.
- Lifetime: auto-dismisses after `CHIP_TTL_MS = 5000`. Multiple rapid block events reuse the visible chip (counter increments) rather than stacking.
- **Undo** restores every element of the chip's block event(s) to recorded styles, re-applies nothing else, and **pauses Nagless in that tab until the next real page load** (in-memory flag) so the restored popup isn't instantly re-hidden. The chip then disappears; no further UI.

## 7. Counters, badge, storage

### 7.1 Flow

- Content script sends `runtime.sendMessage({type: 'nagless:blocked', count})` per block event.
- Background: increments a per-tab session count in `storage.session` (keyed by `sender.tab.id`, survives service-worker restarts), sets `action.setBadgeText` for that tab (desktop; Firefox Android has no badge — the popup shows the numbers), and increments lifetime `totalBlocked` in `storage.local`.
- Per-tab count resets when the tab navigates (`tabs.onUpdated` `status === 'loading'`; no `"tabs"` permission needed for status).

### 7.2 `storage.local` schema

```json
{
  "enabled": true,
  "allowlist": ["example.com"],
  "totalBlocked": 0
}
```

Hostnames are normalized by lowercasing and stripping a leading `www.`; matching is exact on the normalized host.

## 8. Extension surfaces & manifests

### 8.1 Components

| Component | Files | Role |
|---|---|---|
| Content script | `src/common/scoring.js`, `src/content/content.js` | Detection engine, block actions, undo chip. Plain scripts sharing scope (declared in order in `content_scripts.js`) |
| Background | `src/background.js` | Install defaults, badge, counters. Written event-page-safe: no reliance on in-memory state (works as Firefox event page and Chrome service worker) |
| Popup | `src/popup/popup.html`, `popup.css`, `popup.js` | Controls (§9) |
| Icons | `src/icons/` | PNGs 16/32/48/96/128 generated from `assets/icon.svg` |

Browser API access: `const api = globalThis.browser ?? globalThis.chrome;` with promise style throughout (both browsers support promises on these APIs in MV3). No polyfill dependency.

### 8.2 Manifests (two static files, one shared `src/`)

Common: `manifest_version: 3`, name `Nagless`, `permissions: ["storage"]`, `host_permissions: ["<all_urls>"]`, `content_scripts` (matches `<all_urls>`, `run_at: document_idle`, top frame only), `action` with `default_popup`.

| Key | `manifest.firefox.json` | `manifest.chrome.json` |
|---|---|---|
| `background` | `{"scripts": ["background.js"]}` | `{"service_worker": "background.js"}` |
| `browser_specific_settings` | `gecko.id: "muhannad.dev@gmail.com"`, `gecko.strict_min_version: "121.0"`, `gecko_android.strict_min_version: "121.0"` | — (CWS-unfriendly key omitted) |
| `minimum_chrome_version` | — | `"121"` |

(Verified against MDN 2026-08-21: Firefox MV3 has no `service_worker` support and requires the gecko ID; Chrome 121+/Firefox 121+ each ignore the other's background key, but we ship clean per-store manifests anyway.)

### 8.3 Firefox host-permission reality

Firefox MV3 treats `host_permissions` as **opt-in** (shown in the install prompt since Fx127, still revocable/deniable). The popup therefore checks `permissions.contains({origins: ["<all_urls>"]})` and, when missing, replaces its content with an explainer and a **Grant access to websites** button calling `permissions.request(...)`. Chrome grants at install; the same code path simply never triggers.

## 9. Popup UI

Single small view (renders as a bottom sheet on Firefox Android — controls sized for thumbs, ≥ 44px):

1. Header: icon + **Nagless**.
2. **Global toggle** (Enabled).
3. **This site** row: normalized hostname + toggle (off = add to allowlist). Disabled state when the current tab has no eligible host (about:, store pages, etc.).
4. Counters: blocked on this page · total all-time.
5. Firefox-only permission banner (§8.3) when access is missing.

No `alert()`; state feedback is inline. No options page in v1 — the popup is the entire UI.

## 10. Repository layout

```
├── README.md
├── LICENSE                  (MIT)
├── PRIVACY.md               (no-data-collection statement; linked from store listings)
├── docs/
│   ├── SPEC.md              (this document)
│   ├── IMPLEMENTATION.md    (phased build plan + task checklist)
│   └── PUBLISHING.md        (AMO + CWS submission runbook, listing copy, screenshots list)
├── src/                     (shared, browser-agnostic)
│   ├── background.js
│   ├── common/scoring.js
│   ├── content/content.js
│   ├── popup/popup.{html,css,js}
│   └── icons/*.png
├── manifest.firefox.json
├── manifest.chrome.json
├── assets/icon.svg
├── tools/build.mjs          (zero-dep: assembles dist/{firefox,chrome}, zips artifacts)
├── test/
│   ├── unit/                (node --test against scoring pure functions)
│   ├── fixtures/            (self-contained nag simulations, served over local HTTP)
│   └── e2e/                 (Playwright: chromium + --load-extension against fixtures)
└── .github/workflows/ci.yml (unit + build + web-ext lint + e2e)
```

Dev dependencies only: `web-ext` (lint / desktop & Android run / AMO sign), `@playwright/test`. Node ≥ 20.

## 11. Test plan

1. **Unit** (`node --test`): scoring weights and gates as pure functions on synthetic candidate descriptors; hostname normalization; grouping/caps logic.
2. **Fixtures** (each a standalone page): scroll-triggered newsletter modal (+backdrop +`overflow` lock); timed interstitial; `body{position:fixed}` lock variant; autofocus-email modal (keyboard case); display-toggle modal pre-existing in DOM; SPA-style late injection; small cookie banner (must NOT block); **user-opened modal via button (must NOT block)**.
3. **E2E** (Playwright, CI): chromium with `--load-extension=dist/chrome`, fixtures over local HTTP. Asserts: nag hidden, backdrop hidden, scroll unlocked & position kept, focused input blurred, legit modal untouched, undo restores and pauses.
4. **Manual desktop:** `web-ext run` (Firefox), `chrome://extensions` load-unpacked; popup toggles, allowlist live-reactivity, badge.
5. **Manual Android (the gate before publishing):** `web-ext run -t firefox-android --adb-device <id> --firefox-apk org.mozilla.firefox` against release Firefox for Android (phone: USB debugging + Firefox "Remote debugging via USB"; host: adb). Verify on fixtures + a list of real offender sites: nag gone, **no keyboard popup**, scrolling intact, undo chip tappable, popup usable as bottom sheet.
6. **Pre-submission:** `web-ext lint` clean on `dist/firefox`; package size sanity (< 100 KB).

## 12. Success criteria (v1 ships when all hold)

- All fixture-based e2e assertions pass in CI on chromium.
- On the maintainer's Android phone (release Firefox): ≥ 4 of 5 chosen real offender sites show no nag and no keyboard popup; zero broken user-opened modals across fixtures and those sites.
- Undo restores within one tap; per-site off switch verified live.
- `web-ext lint`: 0 errors. No console errors on fixtures.
- Listings prepared for AMO + CWS with privacy statements and `<all_urls>` justification; both packages submitted.

## 13. Risks & mitigations

| Risk | Mitigation |
|---|---|
| False positives despite gating | Hide-not-delete, undo chip, per-tab pause after undo, per-site allowlist |
| Sites re-asserting locks / re-inserting modals in a loop | Bounded re-unlock window, per-signature and per-page caps (§5.5) |
| Heuristic misses on exotic nags | Accepted for v1; scoring module is the seam for v2 filter-list rules |
| CWS review friction over `<all_urls>` | Honest justification (must detect overlays on arbitrary sites; zero data collection; no remote code); expect days-not-hours review |
| Firefox users deny host access | Popup permission banner explains and requests (§8.3) |
| Battery/perf on mobile | rAF-batched observation, bounded traversals, no polling; perf budget in §5.2 |
| Name/trademark | Collision-checked 2026-08-21; only unrelated-category nagless.com exists |

## 14. Post-v1 roadmap (recorded, not committed)

Optional filter-list rules; `all_frames` for iframe-hosted overlays; Edge Add-ons listing; i18n; `storage.sync`; per-element "zap" picker; Safari port.
