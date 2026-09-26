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
3. `git tag -s v<version> -m "Nagless <version> — <one line>"` on the release commit; `git verify-tag v<version>`; push with `--tags`. Tags are **always signed** — signing is SSH (`gpg.format=ssh`, `tag.gpgsign=true`), not GPG.
4. `npm run build` → upload `dist/nagless-firefox-<version>.zip` to AMO, `dist/nagless-chrome-<version>.zip` to CWS.
5. **Clean-zip check (always, before any upload):** `unzip -l dist/*.zip | grep -i "ds_store\|thumbs.db\|desktop.ini"` must return nothing. The build filters OS junk since 1.0.1, but verify anyway — a stray file in the zip draws an AMO validator warning.
6. **Write the two submission texts (always, unprompted — they are required fields, so the version is not ready without them):**
   - **Release Notes** (user-facing): what broke, what it looked like, what works now. No internals.
   - **Notes to Reviewer** (private to AMO reviewers): lead with the permission delta, saying plainly when there is none; summarize the zip diff by file and line count; pre-empt anything that looks alarming out of context (new event listeners, new APIs) with when it is registered, when it is removed, and what data it touches; carry forward the standing facts (no bundler or minification so the zip is literal source, icons rendered from `assets/icon.svg`, zero network requests, `data_collection_permissions: none`); close with a reproduction recipe and the repo link.
   - If the notes reference GitHub, push the release commits first or the reviewer follows a dead link.
7. **Publish the GitHub Release (always, unprompted — a shipped version that isn't on the Releases page is invisible to anyone reading the repo):** `gh release create v<version> --verify-tag --title "Nagless <version>" --notes-file <file> --latest` (use `--latest=false` when backfilling an older version). Notes are user-facing in the same style as the AMO Release Notes — no internals, no diff stats, and no claim about store approval status, which is permanent and easy to get wrong. Attach binaries only on purpose: an unsigned zip on a release page reads as installable when the real distribution channel is the store.
   - Force-updating a tag in place keeps its Release attached, but deleting and recreating a tag on the remote reverts that Release to a **draft** — after any history rewrite, confirm with `gh release list` that every release is still published and points at the new commit.
8. Keep AMO and CWS versions identical; store listing text changes don't need a version bump.

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

### 2026-09-26 — v1.0.8: taps inside frames

- **Found in review of 1.0.7.** A tap inside an iframe is dispatched in the frame's own document, so the gesture listeners on the top window never saw it. Since 1.0.7 made same-origin frames candidates, anything the user opened from inside a frame looked uninvited, and the frame-intent rule was the only backstop. Two cases misfired. A chat opened from its launcher frame whose transcript asks "Want to get notified when an agent replies?" with a Yes button was hidden, because the ask counts as intent. A lightbox viewer opened from a gallery frame was hidden on its `lightbox` class, and right after an unrelated block it was also swept as a detached dim, since the dim paths check only that an element is uninvited.
- **Measured before designing** (Chromium through Playwright; Firefox 156 through puppeteer-core over WebDriver BiDi; mouse and touch):
  - A first tap into a frame, same-origin or cross-origin, blurs the top window in both engines. A repeat tap in a frame that already has focus fires nothing.
  - During the blur event Chromium already reports the iframe as `document.activeElement`, and Firefox still reports `BODY`, switching a task later. The rule as first proposed, checked in the blur handler, never fires on Firefox. Ablation confirms it: deciding at blur time hides the asking chat and both viewers in Firefox.
  - `navigator.userActivation.isActive` is true after a tap in both engines and false when a page script calls `focus()` into a frame with no input. It stays true for about 5 s after any real input.
  - LaraPush on sammobile.com (live, real script) never moves focus. Neither engine sees a blur, on phone or desktop.
  - Playwright's locator polling runs with a user gesture in Chromium and grants the page user activation, so a test of script focus must leave the page alone until the prompt has been judged.
- **Fix.** A top-window `blur` is recorded, and when the gesture time is next read it counts as a gesture if focus landed in an `<iframe>` and the page has transient user activation. Deciding on read covers Firefox's late `activeElement`, and a race seen in Chromium: with a one-task timer, the flush judged the chat opened by the tap 2 ms before the timer fired.
- **Proven non-vacuous by ablation:** taps into frames not seen → the six new KEEP cases fail (asking chat on phone and desktop; viewer on phone and desktop, plain and right after a block); script focus counted as a tap → both self-focusing prompt BLOCK cases fail. The 1.0.7 ablations still fail their own cases. The frame-intent rule is now pinned by a chat reopened with a repeat tap, and the see-through dim rule by a chat that opens by itself right after a block.
- **Verified:** Firefox 156 fixture matrix on phone (touch taps) and desktop (mouse): the asking chat, both viewers and the reopened chat stay, and the self-focusing prompt and the LaraPush-style prompt are hidden. Live sammobile.com is unchanged, with both LaraPush frames hidden and the chip shown in Chromium and Firefox at 412×800, 1280×800 and 1920×1080.
- **Not verified:** Firefox for Android on a device. Firefox desktop moves focus into a frame on a touch tap, and GeckoView is the same engine.
- **Known limits.**
  - A repeat tap in a frame that already has focus is still invisible, so the frame-intent rule stays as the backstop. A chat that asks about notifications and is reopened from a launcher that kept focus is still hidden.
  - A frame focused by script within about 5 s of any real input counts as a tap, so a prompt that focuses itself shortly after the user tapped something would look invited. LaraPush does not focus itself.
- **Regression fixtures:** `chat-launcher-frame.html?ask=1` (KEEP, phone and desktop) and `frame-viewer.html`, plain and `?nag=1` (KEEP, phone and desktop), all six failing against the 1.0.7 build; the reopen sequence on `chat-launcher-frame.html` (KEEP) and `push-prompt-iframes.html?focus=1` (BLOCK, phone and 1920×1080) as guards. `chat-launcher-frame.html?nag=1` now opens the chat by itself. 38 unit + 40 e2e green, `web-ext lint` clean.

### 2026-09-26 — v1.0.7: push prompts drawn inside iframes (sammobile.com, again)

- **Reported (owner, Firefox for Android, 1.0.6, screenshot):** the same LaraPush prompt ("We'd like to show you notifications for the latest important news and updates", **Close** / **Allow**) still dropped in from the top of a sammobile.com article and dimmed the page. 1.0.6 was the release meant to fix it.
- **Why 1.0.6 missed it.** Its fixture was guessed from the first screenshot, because that session could reach neither sammobile.com nor larapush.com. The real prompt is not in the page's own document at all. LaraPush 5.0.0 appends two iframes with no `src` and writes their documents itself, so both are same-origin. Seen from the page, each is an empty, transparent frame. Nagless never treated an `<iframe>` as a candidate, read an element's text only from its own subtree, and judged a dim by the element's own background, so it had nothing to act on.
- **Reproduced live this time.** This Mac reaches sammobile.com but not `cdn.larapush.com` (connection refused, in the in-app browser too), so the probes serve the exact `larapush-popup-5.0.0.min.js` from a Wayback Machine snapshot of 2026-09-25 in place of the CDN copy. The page's config: 15 s delay, `popup_type: manual-backdrop`, backdrop on, `lockPageContent` off, top placement on mobile. Firefox would not start under automation until it was given a throwaway home folder (`CFFIXED_USER_HOME`), because macOS denies processes launched by Claude access to `~/Library/Application Support/Firefox`. With that, the 1.0.6 build reproduced the report in Firefox 156 with an Android user agent: both frames up, no chip.
- **What the page does.** About 15.4 s after load LaraPush adds both frames to `body` in one task. The dim frame is fixed, full viewport, transparent, `z-index: 2147483646` and `pointer-events: auto`; inside it a fixed `div.backdrop` paints `rgba(0,0,0,0.74)` around a hidden "This page content is locked" box. The prompt frame is fixed at the top left, `width: 100%; max-width: 435px; height: 188px`, `z-index: 2147483647`, and holds `#larapush-optin` with Close and Allow buttons, no role and no input. The two are not siblings (body children 3 and 17 of 23 in one run).
- **A second miss, on desktop.** At 435×188 the card covers 7.99% of a 1280×800 viewport and 3.9% of 1920×1080, under the 8% floor 1.0.6 gave the ask. The 1.0.6 entry listed 1920×1080 as a known limit; the real card also misses on a 1280×800 laptop.
- **Fix, three parts.**
  1. A frame whose document is readable and whose body holds something is a candidate. Its text feeds the notification ask and its paint feeds the detached-dim test. For a frame the dim test counts rendered text, because LaraPush's dim hides copy inside itself, and it needs a see-through layer, because an opaque layer filling a frame is an app still loading. Cross-origin frames stay out, including the empty `about:blank` a cross-origin frame shows until its `src` loads.
  2. A frame that asks for notifications has no size floor, since it is the prompt itself and a fixed-size card defeats every fraction of the viewport. It still needs a second signal (LaraPush's z-index) to reach the threshold. In the page the ask keeps 1.0.6's 8% floor.
  3. A frame must show intent (an ask, dialog semantics, or a nag word on the frame element) to be blocked. A tap inside a frame never reaches Nagless's gesture listener, so a chat messenger opened from its launcher frame looks uninvited. Without this rule the new `chat-launcher-frame` KEEP fixture is hidden, chip and all, with its scroll lock undone.
- **Review (two adversarial reviewers, Sonnet and Opus).** Two findings changed the code.
  - The frame-intent rule does not cover the detached-dim paths, which skip scoring. A chat opened within 2 s of an unrelated block, still on its opaque loading screen, was swept as a dim. `chat-launcher-frame.html?nag=1` reproduces it, and requiring a see-through layer in a frame's dim test fixes it.
  - Exempting every ask from the size floor hid page chrome that 1.0.6 kept. The reviewer's case was a 56 px sticky header (z-index 1000, 7% of a phone screen) holding a hidden "Get breaking news notifications?" template with Yes / Not now; `textsOf` reads hidden text, so the header asked and was hidden at load. The exemption now applies to frames only, which is all the evidence needs, and page elements keep 1.0.6's floor exactly.
- **Design.** Three candidate designs were sketched in parallel. The base adds a single `frameBody()` read path and was already verified in a scratch copy; the frame-intent rule came from a second candidate. Rejected: an absolute pixel floor for the ask (fitted to one card), treating every iframe as a candidate (cross-origin frames would be scored on their box alone), and reading inputs, video and dialog roles through frames (no evidence, and it arms same-origin chat widgets).
- **Proven non-vacuous by ablation** (the built `dist` mutated one piece at a time): dim-test frame branch off → the three iframe BLOCK cases fail on the dim, and so does the `?nag=1` chat, whose white iframe then reads as a dim; a frame's ask held to the 8% floor → only the 1920×1080 case fails; frame text not read, or frames not candidates → the three BLOCK cases fail; frame-intent rule off → both chat KEEPs fail; opaque frame layers accepted as dims → only the `?nag=1` chat fails.
- **Verified live on sammobile.com (real LaraPush 5.0.0):** Chromium and Firefox 156 at 412×800 (Android user agent in Firefox), 1280×800 and 1920×1080. At all six, both frames get `display: none !important`, the chip shows and the page scrolls. Firefox fixture matrix: the iframe prompt is hidden on a phone, when already up at injection, and at 1920×1080; the page-drawn prompt is still hidden; the prompt opened by a click and the chat opened from a launcher frame both stay.
- **Not verified:** Firefox for Android on a device (no phone attached over adb). Gecko is the same engine, and the Firefox runs exercised every read through a frame (`contentDocument`, `createTreeWalker`, `innerText`, `getComputedStyle` through the frame's window). Still to confirm on the phone: about 15 s after opening an article the prompt and the dim are gone and taps reach the page. LaraPush stops showing the prompt for 14 days after a tap on Close, so clear sammobile.com's site data first if it was ever closed by hand.
- **Known limits.**
  - Taps inside a frame are invisible to the gesture listener. The intent rule is the backstop, and it cannot tell a user-opened frame that happens to ask from a nag: a chat opened from its launcher frame whose transcript asks "Want to get notified when an agent replies?" with a Yes button is hidden. A translucent viewer frame opened from another frame within 2 s of an unrelated block is swept as a dim. The reviewer's root fix is to count focus moving into a frame (`blur` on the top window with an iframe as `activeElement`) as a gesture. It changes the gesture model for every element and could make a prompt that focuses itself look invited, so it needs Gecko and phone evidence first.
  - A page-drawn push card still needs 8% of the viewport, so on a large desktop screen it is left alone, as in 1.0.6.
  - A frame whose content arrives after insertion (a same-origin `src`, or an asynchronous write) is judged empty and missed. If a real page shows this, queue iframes on `load` captured on `document`.
  - A LaraPush site with `lockPageContent` on renders the lock text inside the dim, so that dim fails the dim test and stays after the card is blocked.
- **Regression fixtures:** `push-prompt-iframes.html` (BLOCK: phone timed, phone `?at=load`, 1920×1080; KEEP with `?by=click`), proven non-vacuous: all three BLOCK variants fail against the 1.0.6 build. `chat-launcher-frame.html` (KEEP, plain and `?nag=1`). 38 unit + 31 e2e green, `web-ext lint` clean, both zips junk-free.

### 2026-09-26 — v1.0.6: slide-in subscription sheet (theverge.com)

- **Reported (owner, Firefox for Android, screenshot):** on theverge.com a teal "Continue reading with a Verge subscription" sheet (**START YOUR TRIAL**, Sign in, Back to the homepage) covered the bottom third of the screen and stayed. The page behind it was not dimmed.
- **Reproducing it took two workarounds.** The paywall is Zephr, and this Mac cannot reach `assets.zephr.com` (connection refused within 7 ms, even in the in-app browser), so no local browser ever ran it. The probes serve the same SDK, `@zephr/browser@1.9.1` from npm, in place of the CDN copy. The Zephr SDK sends its decision calls to the site's own origin (`/zephr/features`, `/zephr/feature-decisions`), and with the SDK present a fresh profile gets the paywall on its first article once it scrolls. The scroll is the trigger, so a probe that never scrolls never sees it.
- **What the page does:** Zephr renders `#zephr-zone-footer` (fixed, `z-index: 100000`) and `#zephr-overlay` (full-viewport, 50% black, the last child of `body`) hidden at about 1 s. On the first scroll it shows both, pins `body` with `position: fixed; top: -Npx`, and parks the sheet at `bottom: -100vh`. A second later a `.transform` class slides it up with `transition: translate .3s`.
- **Root cause, two parts, both confirmed by an instrumented build:**
  1. The sheet is never judged on screen. Its only DOM mutations happen while it is still a viewport below the screen, and the slide itself is a CSS transition, which no MutationObserver sees.
  2. Blocking the dim takes the sheet's evidence with it. The dim is judged first and blocked on its own (lock +2, z-index +1, near-fullscreen +1, `overlay` class +1), and that block lifts the lock. `lockNearby` required the page to still be locked, so when the sheet was finally judged it scored 1 (z-index only). This is why the owner saw the dim gone and the sheet still up.
- **Fix:** queue an element for evaluation when its CSS transition or animation ends, and keep the time the page imposed its lock after a block lifts it. The sheet then scores 3 (lock +2, z-index +1). Ablation on the fixture: removing either part fails both slide-in e2e variants.
- **Tried and reverted:** timing a parked element's appearance from when it was shown rather than when it arrived on screen, to keep slow user-opened drawers counted as invited. The `user-drawer` fixture showed it does not matter: the class change that starts a drawer's slide lands after the first transition frame, so the drawer is already partly on screen and gets its appearance time then. That fixture stays as a KEEP guard.
- **Verified live (Chromium via Playwright, SDK served locally):** phone profile (Pixel 7, 412×839) and desktop (1280×800). The dim is hidden when it shows, `body` is unlocked, and the sheet is hidden within 50 ms of landing (4.1 s and 4.2 s after navigation). The 1.0.6-before-this-fix build leaves the sheet up at `top: 503` on desktop. The article itself stays cut off at Zephr's inline "Subscribe to The Verge to continue reading." box. Nagless hides overlays and does not restore removed text.
- **Not verified:** Firefox. Both Playwright's Firefox and the installed release Firefox fail to start inside this session's process sandbox, and the phone was not attached over adb. Still to confirm on the phone: the sheet is gone after it slides up, and the page scrolls.
- **Unexplained variance:** in 3 of 6 scrolling phone-profile runs with the extension loaded (old and new build alike), the paywall never showed. The two of those that logged the DOM had not even Zephr's hidden shell, which it inserts before any scroll. Without the extension it showed 5 of 5, and on desktop 2 of 2 with it. The sample is too small to blame the extension, and a paywall that never shows costs the reader nothing.
- **Regression fixtures:** `slide-in-sheet.html` (BLOCK), phone and desktop, proven non-vacuous: both e2e variants fail against the build before this fix. `user-drawer.html` (KEEP), a cart drawer that finishes sliding in 1.1 s after the tap, stays open.

### 2026-09-26 — v1.0.6: push-notification prompts (sammobile.com)

- **Reported (owner, Firefox for Android, screenshot):** on a sammobile.com article a LaraPush prompt ("We'd like to show you notifications for the latest important news and updates", **Close** / **Allow**, "powered by LaraPush") dropped in from the top and dimmed the page. Nagless did not touch it.
- **Why every existing signal missed it:** the card has no input (the +2 a signup nag earns), no dialog role, no scroll lock, and no nag word in its class names. At about 15% of a phone viewport it is under the 25% raw-size gate, so it needed a backdrop, lock or dialog to earn the 8% floor. The page's reading-progress bar paints *between* the dim and the card, so the dim and the card are separate stacking contexts: the dim is not the card's parent, and nothing makes it an adjacent sibling either.
- **Fix, part 1: the notification ask.** A new +2 signal fires when a candidate's text mentions notifications and carries a button-sized `Allow`/`Yes` label, whatever the markup. It also earns the 8% size floor and counts as intent for elements already up at injection, in case the prompt lands before `document_idle`. `Subscribe` and `Turn on` are left out on purpose, because sticky headers put them next to a notifications link. With the usual very high z-index the card scores 3 on its own.
- **Fix, part 2: detached dims.** The dim sweep used to run only for dialog walls, and only over dims already evaluated. A batch evaluates the small card before the full-viewport dim, so a dim inserted in the same frame as its card was never swept. Now every block sweeps, and a dim evaluated within 2 s after a block is hidden with it. Only dims that appeared uninvited qualify, so the backdrop of something the user opened stays.
- **Not verified live.** The cloud session's network policy denies sammobile.com, larapush.com and the WordPress plugin mirror, so the real markup could not be inspected. The fixture is shaped after the screenshot and the stacking evidence, not after the real DOM. Still to confirm on the phone: the prompt is gone *and* the page is not left dimmed. If a dim remains, the dim is structured differently from the fixture. If the prompt remains, the likely causes are, first, that LaraPush shows it right after a tap (invited by design), then a shadow root or iframe.
- **Known limit:** the 8% floor still applies, so on a large desktop viewport (1920×1080, where this card is about 4%) the prompt is left alone. At 1280×720 it is 9.6% and blocked.
- **Regression fixture:** `push-prompt.html` (BLOCK), timed and `?at=load`, on phone and desktop viewports. Proven non-vacuous: all three e2e variants fail against the 1.0.5 build. Each half of the dim fix was disabled in turn and fails its own variant (evaluate-time path → the timed cases, block-time sweep → `?at=load`).

### 2026-08-29 — v1.0.5: Instagram profile went blank after a block

- **Reported (owner, Firefox for Android, 1.0.4 on-device):** on `instagram.com/<profile>` while logged out, the overlay was blocked and the whole page went black. Undo, then closing the wall by hand, restored it.
- **Not a 1.0.4 regression.** 1.0.3 reproduces identically; 1.0.4 is purely additive scroll code. The defect dates to the 1.0.2 app-shell relaxation and only surfaces on profile pages whose DOM puts the wall inside the content root.
- **Root cause:** G2's app-shell branch accepted *any* positioned, viewport-covering layer carrying a visible dialog, with no requirement that the dialog be most of it. Instagram's content root is positioned, covers the viewport, and contains the login dialog, so it qualified. Nagless hid it and took the entire page with it. The instrumented build logged exactly one hide, `DIV.x9f619 x1n2onr6 x1ja2u2z`, `position: relative`, 292 nodes, 53% of all elements on the page, after which `innerText` was empty and every hit-test point returned `BODY`. The black is Instagram's dark-theme body showing through.
- **Discriminator (measured up the dialog's ancestor chain, both profiles and both layouts):** the dialog's share of the element's own node count. Real wall wrappers score 0.61 to 0.96, the content root scores 0.07 and `<body>` scores 0.03 to 0.05. A threshold of 0.5 sits in a wide empty gap.
- **Fix:** the app-shell branch of G2 now also requires `dialogShare >= 0.5`. The share is computed lazily, only for candidates that reach that branch, so the subtree count never runs on the hot path, and it is never consulted for a `fixed`/`sticky` overlay, which may legitimately be mostly artwork.
- **Verified live (mobile + desktop, two profile URLs each).** Mobile now hides exactly the right element, the `position: fixed`, `z-index: 20` wall layer, and leaves the content root alone: visible text 305 → 212 and images 14 → 13 (the wall's own text and logo), against 0 and 0 before the fix. Desktop still hides the 1.0.2 targets, two `x1n2onr6 xzkaem6` wrappers at 3-4% page share plus the detached dim, with text 1238 → 1132 and images 26 → 25. Screenshots: pre-fix is a fully black viewport, post-fix is the complete profile with no wall.
- **Regression fixture:** `app-shell-content-root.html` (BLOCK). Proven non-vacuous by running it against the 1.0.4 build, which gives `wallHidden=false approotHidden=true visibleText=0`, against `wallHidden=true approotHidden=false visibleText=3564` after the fix.
- 28 unit + 19 e2e green, `web-ext lint` clean, both zips junk-free.

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
