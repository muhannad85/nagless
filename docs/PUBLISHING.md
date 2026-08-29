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
   Permissions reality for store users (researched 2026-08-21): since Firefox 127/128, MV3 host permissions are shown in the install prompt and granted automatically at install on desktop **and** Android, and `permissions.request()` from the popup shows a native Allow/Deny dialog on Android — so the popup's grant banner is only a backstop for users who later revoke access (⋮ → Extensions → Nagless → permission toggles). One known upstream gap: origins added in a future *update* are not auto-shown/granted (Bugzilla 1893232) — **never add a host permission in an update**: for MV3 the update applies silently and the new origin is simply not granted, so the feature relying on it fails with no visible error. Ship host-permission changes only as a fresh install-time grant.
   Adding a *promptable API* permission in an update behaves differently and is safer than it sounds: Firefox postpones the update (the installed version keeps running and stays enabled — Bugzilla 1317470 rejected the disable-then-approve design) until the user accepts. On Android that prompt arrives as a system notification, so a user with notifications off may never see it and the update stalls (Bugzilla 1935685). Permissions with no user-facing description — `scripting` among them — are granted silently and postpone nothing.
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
5. **Clean-zip check (always, before any upload):** `unzip -l dist/*.zip | grep -i "ds_store\|thumbs.db\|desktop.ini"` must return nothing. The build filters OS junk since 1.0.1, but verify anyway — a stray file in the zip draws an AMO validator warning.
6. Keep AMO and CWS versions identical; store listing text changes don't need a version bump.

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

### 2026-08-22 — AMO first submission

- Validator: 0 errors, 2 warnings — `data_collection_permissions` is only understood from Firefox 140 (desktop) / 142 (Android), below our 121 floor. Resolved by raising `strict_min_version` to 140.0 / 142.0; `web-ext lint` clean; re-uploaded `nagless-firefox-1.0.0.zip`.
- **Submitted to AMO as listed version 1.0.0 on 2026-08-22** (source-code question: No — zip is literal source). Awaiting automated publication / possible manual review. Git tag `v1.0.0`.

### 2026-08-29 — v1.0.4: page frozen after a block (gesture-level scroll locks)

- **Reported:** after 1.0.3 correctly blocked the x.com sign-up wall, the page could not be scrolled. Undo followed by dismissing the wall manually restored scrolling.
- **Root cause (confirmed on live x.com/NASA, mobile profile):** X imposes no CSS scroll lock at all — `html`/`body` computed to `overflow: visible`, `position: static`, with no inline style, so `unlockScroll()` correctly found nothing and did nothing. The lock is behavioral: a **capture-phase, non-passive `wheel` + `touchmove` listener on `document`** that calls `preventDefault()` while the wall is flagged open. The listener is registered permanently and is cleared only by the site flipping its own open-flag. Hiding the wall left the guard armed.
- **Evidence (three runs, synthesized swipe through the CDP input pipeline; sanity-checked against a plain tall page that scrolled to 2205):**
  - extension blocks the wall → `defaultPrevented=true`, `scrollY 0 → 0`
  - no extension, wall left up → `defaultPrevented=true`, `scrollY 0 → 0` (identical: hiding neither helps nor hurts)
  - no extension, wall closed via its own "Dismiss" button → `defaultPrevented=false`, `scrollY 0 → 1262`, listener still registered
- **Fix — the scroll shield.** A content script cannot see or remove a page listener across the isolated world, and expando writes such as `event.preventDefault = noop` do not cross it either. So Nagless listens in the **bubble** phase, after the page's handler has run, and scrolls the document by the vertical delta of exactly the gestures the page swallowed (`event.defaultPrevented`). A page that never prevents is never touched. Vertical only, so horizontal carousels and sliders keep their gestures. Installed on the first block, torn down by `restoreAll()` (Undo, global toggle, allowlist).
- **App-shell coverage (added after a "does this cover Meta too?" question).** The first cut of the shield called `window.scrollBy`, which is a no-op when the document is not the scroller. Instagram, Facebook and Threads all size `html`/`body` to the viewport and scroll an inner container, so the shield would have done nothing on any of them had they gesture-locked. Proved with `app-shell-gesture-lock.html` (failed before, passes after). The shield now scrolls the nearest scrollable ancestor of the gesture, resolved once per touch gesture and memoized per wheel target so the hot path costs no style reads.
- **Scroll-lock technique by site (measured bare vs. with the extension, both profiles):**

  | Site | Wall | Lock technique | Result with 1.0.4 |
  |---|---|---|---|
  | x.com (mobile) | yes | **gesture**, non-passive capture `touchmove`+`wheel` on `document` | blocked, document scrolled 0 → 769 |
  | facebook.com (mobile) | yes | **CSS**, `cssLock=true` bare → `false` with the extension | blocked, `unlockScroll()` clears it (unchanged since 1.0.0) |
  | instagram.com (mobile + desktop) | yes | **none**, `defaultPrevented=false`, no CSS lock | blocked; desktop inner scroller moved 0 → 700 |
  | threads.com (desktop) | yes | **none** | blocked, inner scroller moved 0 → 700 |
  | x.com (desktop) | — | — | not probeable, X refuses the automation's desktop profile |

  So x.com is the only one of the four that needs the shield, Facebook was already covered by the CSS path, and Instagram and Threads never locked scrolling in the first place. The app-shell fix is insurance against any of them adopting the technique, and coverage for app-shell sites generally.
- **Known UX limit:** compensated scrolling tracks the finger 1:1 with no inertia, so there is no fling on sites that swallow gestures. Native feel would require `stopPropagation()` in the capture phase, which would also rob the page of every legitimate drag handler. Revisit only if the phone test says the missing fling matters.
- **Verified:** live x.com/NASA mobile — wall blocked and swipe moved `scrollY 0 → 769` (was 0). Instagram mobile + desktop — wall still blocked, desktop inner scroller moved 0 → 800 under a real wheel. YouTube mobile + desktop — untouched, video renders. 26 unit + 18 e2e green, `web-ext lint` clean, both zips junk-free. **Gap: x.com desktop still refuses the automation's desktop profile** (`ERR_HTTP_RESPONSE_CODE_FAILURE`); the fix keys on `defaultPrevented` rather than on anything layout-specific, and the new fixture's assertion drives a desktop wheel event.
- **Process rule (standing): a scroll assertion must drive a real gesture.** `window.scrollTo` bypasses a page's wheel/touchmove guard and passes even when scrolling is dead — every pre-1.0.4 scroll assertion was vacuous against this bug class.
- New regression fixtures: `gesture-lock.html` (BLOCK) reproduces X's mechanism with no CSS lock at all, and `app-shell-gesture-lock.html` (BLOCK) puts the same guard over an inner-scroller app shell.

### 2026-08-29 — v1.0.3: overlays missed on large pages (X.com)

- **Reported:** opening an x.com link from Telegram (custom tab → "Open in Firefox") left the sign-up wall in place.
- **Root cause (confirmed, reproduces without any custom tab):** candidate discovery walked a fixed budget of 400 elements per subtree and silently dropped everything beyond it. On a direct load of x.com/NASA the body held 1,082 elements at scan time; the wall sat at document position 1,542 and was never evaluated (`dialogsReached: 0`). Any large SPA page could hide a nag past the budget.
- **Fix:** dialog-semantic elements are now queried directly at any depth; a nag-name query runs on subtrees whose walk was actually truncated; walk budget raised 400 → 800.
- **Performance (measured, instrumented build):** first attempt regressed the worst-case scan to 32 ms on youtube.com desktop — 24 ms of it the keyword query running across 721 mutation roots in one flush. Gating that query on real truncation brought it to **17.6 ms worst / 1.9 ms average** (x.com: 7.5 ms / 0.8 ms), inside the 50 ms budget.
- **Parity matrix (mobile + desktop profiles):** x.com mobile — wall blocked, tweet content exposed; instagram mobile + desktop — still blocked, no regression; youtube mobile + desktop — player untouched, video plays. **Gap: x.com desktop could not be probed** (X returns an HTTP failure to the automation's desktop profile); the fix is DOM-position based rather than layout based and is covered by the `deep-dom-wall` fixture, but it is unverified on live desktop X.
- **Custom-tab research (relevant to the original report):** content scripts *do* run in Firefox Android custom tabs, and Gecko retroactively injects into already-loaded documents, so the custom-tab → "Open in Firefox" migration (which reuses the session with no reload) does not by itself prevent Nagless from running. No `scripting`-based re-injection was added. If a nag ever survives specifically on that path after this release, the leading remaining cause is Telegram opening links in a **private** custom tab, which migrates into a private regular tab that does not visibly present as private — extensions need "Run in private browsing" enabled.
- New regression fixture: `deep-dom-wall.html` (BLOCK) — a wall past 1,400 elements. 26 unit + 16 e2e green.

### 2026-08-25 — v1.0.2: desktop app-shell login walls

- **Fixed:** Instagram's *desktop* wall still showed after 1.0.1 — desktop IG serves a completely different structure: a `position:relative`, z-indexed, viewport-covering layer over an inner scroll container (no `fixed` anywhere), with detached fixed dim divs. The positioning gate now also accepts positioned, viewport-covering layers that carry a visible dialog; blocking a dialog wall additionally sweeps recently-appeared detached full-viewport dim layers.
- Parity verification matrix (instrumented Chromium): instagram {desktop: wall blocked + page clickable, mobile: blocked}, youtube watch {desktop + mobile: player untouched, video plays}. 26 unit + 16 e2e green; `web-ext lint` clean.
- New regression fixture: `login-wall-desktop.html` (BLOCK, includes detached-dim sweep assertion).
- **Process rule (standing): site-facing changes are verified on BOTH mobile and desktop layouts — they are different pages.** The 1.0.1 IG fix was verified mobile-only; that gap caused this release.

### 2026-08-25 — v1.0.1: YouTube false positive + login-wall support

- **Fixed (bug):** m.youtube.com sticky player was hidden. Root causes: a child's "overlay" class satisfied the page-furniture intent gate, and programmatic focus of player controls counted as the autofocus signal. Fixes: elements containing `<video>` without a text input are never blocked; the focus signal now counts only focused text fields; furniture intent keywords must be on the element itself.
- **Added (feature):** Instagram-style logged-out walls — full-screen preexisting containers with obfuscated classes and `role="dialog"` nested deep inside — are now detected (dialog detection accepts *visible* descendant dialogs at any depth).
- Verified on live m.youtube.com (player untouched, video renders) and instagram.com (wall hidden, no leftover layers, taps reach content) via instrumented Chromium probes; 22 unit + 14 e2e green, `web-ext lint` clean.
- New regression fixtures: `video-player.html` (KEEP), `login-wall.html` (BLOCK).

### 2026-08-21 — Android on-device session (Firefox 154 release, via web-ext/adb)

- Initial "extension does nothing" report root-caused to **private browsing mode**: Firefox (desktop and Android) does not run extensions in private tabs unless the user enables "Run in private browsing" for that extension. Not a Nagless bug; expect the same report from store users — the listing description or a support FAQ should mention it.
- In a normal tab the acceptance case works on-device (owner-confirmed).
- **Full on-device pass (owner-confirmed): all 8 fixture pages behaved as specified on real hardware** — 6 BLOCK pages blocked with chip (autofocus case: no keyboard), 2 KEEP pages untouched, via the fixture index page. The Android publishing gate from SPEC §11.5 is met.
- Ops note: `adb reverse` port mappings can drop when Firefox restarts — re-run `adb reverse tcp:8907 tcp:8907` if fixture pages stop loading on the phone.
