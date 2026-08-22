# Nagless Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build, test, and package Nagless — an MV3 popup/nag blocker for Firefox (desktop + Android) and Chrome/Edge desktop — to the point where it passes CI and is ready for on-phone testing and store submission.

**Architecture:** A content script hosts the whole detection engine (interaction gating → mutation-batched candidate discovery → pure-function scoring → hide/unlock/blur + undo chip). A minimal event-page-safe background script keeps badge/counters. A popup provides the only UI. One shared `src/`, two static per-store manifests, a zero-dependency build script that assembles `dist/firefox` and `dist/chrome`.

**Tech Stack:** Vanilla JS (no runtime deps, no bundler), Node ≥ 20, `web-ext` (lint/run/sign), `@playwright/test` (e2e + icon rendering), `node --test` (unit), GitHub Actions.

## Global Constraints (from docs/SPEC.md)

- Manifest V3 only. Minimums: Firefox `gecko.strict_min_version: "140.0"`, `gecko_android.strict_min_version: "142.0"` (floor of the `data_collection_permissions` key AMO requires), Chrome `minimum_chrome_version: "121"`.
- Firefox add-on ID (permanent): `muhannad.dev@gmail.com`.
- Extension name everywhere: **Nagless**. Version starts `1.0.0`.
- Permissions exactly: `["storage"]` + `host_permissions: ["<all_urls>"]`. Nothing else. No network requests anywhere in shipped code.
- Hide, never `.remove()`. All numeric heuristics live in `NaglessScoring.CONFIG` (src/common/scoring.js) only.
- Browser API access pattern everywhere: `const api = globalThis.browser ?? globalThis.chrome;` promise-style.
- Background must be event-page-safe: no in-memory state that matters across restarts (use `storage.session`).
- Content scripts are classic scripts (no ES modules): `common/scoring.js` then `content/content.js` share scope.
- Commit after every task with the trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

**Two approved spec refinements to apply during Task 6 (edit docs/SPEC.md in the same commit):**
1. §5.1 gesture list becomes **`click` (anywhere) + `keydown` on interactive targets** — `pointerdown`/`touchstart` would mark touch-*scrolling* as a gesture and unblock the primary mobile case (scroll-triggered popups); scroll must never count as an invitation.
2. §6 chip shadow root mode becomes **`open`** — `closed` only hides `host.shadowRoot` from page JS (the host node is deletable either way) while breaking Playwright assertions and debuggability.

---

### Task 1: Project scaffold + icon pipeline

**Files:**
- Create: `package.json`
- Create: `assets/icon.svg`
- Create: `tools/gen-icons.mjs`
- Output (committed): `src/icons/icon-{16,32,48,96,128}.png`

**Interfaces:**
- Consumes: nothing (first code task).
- Produces: npm scripts (`build`, `icons`, `test`, `e2e`, `fixtures`, `lint`, `start:firefox`, `start:android`, `sign`) that later tasks call; icon PNGs the manifests (Task 4) reference as `icons/icon-<size>.png`.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "nagless",
  "version": "1.0.0",
  "private": true,
  "description": "Popup & nag blocker — hides uninvited overlays, unlocks scrolling, dismisses the keyboard.",
  "license": "MIT",
  "engines": { "node": ">=20" },
  "scripts": {
    "icons": "node tools/gen-icons.mjs",
    "build": "node tools/build.mjs",
    "test": "node --test test/unit/*.test.mjs",
    "e2e": "npm run build && playwright test",
    "fixtures": "node test/fixtures/serve.mjs",
    "lint": "npm run build && web-ext lint --source-dir dist/firefox",
    "start:firefox": "npm run build && web-ext run --source-dir dist/firefox",
    "start:android": "npm run build && web-ext run -t firefox-android --source-dir dist/firefox --firefox-apk org.mozilla.firefox",
    "sign": "npm run build && web-ext sign --source-dir dist/firefox --channel listed"
  },
  "devDependencies": {
    "@playwright/test": "^1.48.0",
    "web-ext": "^8.3.0"
  }
}
```

- [ ] **Step 2: Install dependencies and the Playwright browser**

Run: `npm install && npx playwright install chromium`
Expected: lockfile created, no errors. (`package-lock.json` gets committed.)

- [ ] **Step 3: Write `assets/icon.svg`** — a blocked-popup glyph: indigo rounded square, white "popup card" with text lines, coral slash.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect x="4" y="4" width="120" height="120" rx="28" fill="#4F46E5"/>
  <rect x="28" y="38" width="72" height="52" rx="8" fill="#FFFFFF"/>
  <rect x="36" y="50" width="40" height="6" rx="3" fill="#C7D2FE"/>
  <rect x="36" y="62" width="56" height="6" rx="3" fill="#C7D2FE"/>
  <rect x="36" y="74" width="48" height="6" rx="3" fill="#C7D2FE"/>
  <line x1="30" y1="98" x2="98" y2="30" stroke="#F43F5E" stroke-width="12" stroke-linecap="round"/>
</svg>
```

- [ ] **Step 4: Write `tools/gen-icons.mjs`** (renders the SVG to PNGs with Playwright's chromium — no image libs needed)

```js
import { chromium } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(join(root, "assets/icon.svg"), "utf8");
const sizes = [16, 32, 48, 96, 128];
const outDir = join(root, "src/icons");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of sizes) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;padding:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`
  );
  await page.screenshot({ path: join(outDir, `icon-${size}.png`), omitBackground: true });
  console.log(`icon-${size}.png`);
}
await browser.close();
```

- [ ] **Step 5: Generate and verify the icons**

Run: `npm run icons && sips -g pixelWidth -g pixelHeight src/icons/icon-*.png`
Expected: five PNGs; each reports pixelWidth == pixelHeight == its filename size.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json assets/ tools/gen-icons.mjs src/icons/
git commit -m "Scaffold npm project and icon generation pipeline"
```

---

### Task 2: Scoring module (pure heuristics, TDD)

**Files:**
- Create: `test/unit/scoring.test.mjs`
- Create: `src/common/scoring.js`

**Interfaces:**
- Consumes: nothing.
- Produces: global `NaglessScoring` (classic-script global; also CommonJS-exported for tests) with **exactly**:
  - `CONFIG` — all tunables (see Step 3).
  - `passesHardGates(candidate) -> boolean`
  - `softScore(candidate) -> number`
  - `shouldBlock(candidate) -> boolean` (gates && score ≥ threshold)
  - `isUninvited(appearedTs, lastGestureTs) -> boolean`
  - `normalizeHost(hostname) -> string` (lowercase, strip leading `www.`)
  - `keywordHit(text) -> boolean`
  - Candidate descriptor shape (plain object, DOM-free): `{ uninvited, isOwnUi, alreadyProcessed, preexisting, position, visible, opacity, viewportCoverage, widthFraction, heightFraction, zIndex, hasDialogSemantics, hasTextInput, autofocusSeen, keywordHit, hasBackdrop, scrollLockNearby }`

- [ ] **Step 1: Write the failing tests** — `test/unit/scoring.test.mjs`

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const S = createRequire(import.meta.url)("../../src/common/scoring.js");

const base = {
  uninvited: true, isOwnUi: false, alreadyProcessed: false, preexisting: false,
  position: "fixed", visible: true, opacity: 1,
  viewportCoverage: 0.5, widthFraction: 0.7, heightFraction: 0.7,
  zIndex: 2000, hasDialogSemantics: false, hasTextInput: false, autofocusSeen: false,
  keywordHit: false, hasBackdrop: false, scrollLockNearby: false,
};

test("newsletter modal composite blocks: lock + email input + high z", () => {
  const c = { ...base, scrollLockNearby: true, hasTextInput: true };
  assert.equal(S.shouldBlock(c), true); // 2 + 2 + 1 = 5 >= 3
});

test("invited overlays never block regardless of score", () => {
  const c = { ...base, uninvited: false, scrollLockNearby: true, hasTextInput: true, hasDialogSemantics: true };
  assert.equal(S.shouldBlock(c), false);
});

test("non-fixed positioning fails hard gates", () => {
  assert.equal(S.passesHardGates({ ...base, position: "absolute" }), false);
  assert.equal(S.passesHardGates({ ...base, position: "static" }), false);
  assert.equal(S.passesHardGates({ ...base, position: "sticky" }), true);
});

test("small cookie banner fails the size gate", () => {
  const c = { ...base, viewportCoverage: 0.12, widthFraction: 1, heightFraction: 0.12 };
  assert.equal(S.passesHardGates(c), false);
});

test("full-width bottom sheet passes the size gate", () => {
  const c = { ...base, viewportCoverage: 0.22, widthFraction: 1, heightFraction: 0.22 };
  assert.equal(S.passesHardGates(c), true);
});

test("standalone dimmer reaches threshold: lock + near-fullscreen + z", () => {
  const c = { ...base, viewportCoverage: 0.97, widthFraction: 1, heightFraction: 1, scrollLockNearby: true };
  assert.equal(S.softScore(c), 4);
  assert.equal(S.shouldBlock(c), true);
});

test("high z alone does not reach threshold", () => {
  assert.equal(S.shouldBlock({ ...base }), false); // z:2000 only => 1
});

test("preexisting page furniture needs intent signals (dialog/keyword)", () => {
  const appShell = { ...base, preexisting: true, viewportCoverage: 0.95, scrollLockNearby: true, hasTextInput: true };
  assert.equal(S.shouldBlock(appShell), false);
  assert.equal(S.shouldBlock({ ...appShell, keywordHit: true }), true);
  assert.equal(S.shouldBlock({ ...appShell, hasDialogSemantics: true }), true);
});

test("invisible or transparent candidates fail gates", () => {
  assert.equal(S.passesHardGates({ ...base, visible: false }), false);
  assert.equal(S.passesHardGates({ ...base, opacity: 0.02 }), false);
});

test("isUninvited: no gesture ever means uninvited", () => {
  assert.equal(S.isUninvited(500, -Infinity), true);
});

test("isUninvited respects the gesture window", () => {
  assert.equal(S.isUninvited(1500, 1000), false); // 500ms after gesture: invited
  assert.equal(S.isUninvited(2500, 1000), true);  // 1500ms after: uninvited
});

test("normalizeHost lowercases and strips www.", () => {
  assert.equal(S.normalizeHost("WWW.Example.COM"), "example.com");
  assert.equal(S.normalizeHost("news.example.com"), "news.example.com");
  assert.equal(S.normalizeHost(undefined), "");
});

test("keywordHit matches nag vocabulary case-insensitively", () => {
  assert.equal(S.keywordHit("js-Newsletter-Modal open"), true);
  assert.equal(S.keywordHit("site-header nav"), false);
  assert.equal(S.keywordHit(""), false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot find module `../../src/common/scoring.js`.

- [ ] **Step 3: Write `src/common/scoring.js`**

```js
"use strict";
// Pure detection heuristics. No DOM, no browser APIs — unit-testable in Node.
// Loaded as a classic script before content/content.js (shares scope via the
// NaglessScoring global); the module.exports guard is for node --test only.

var NaglessScoring = (() => {
  const CONFIG = {
    GESTURE_WINDOW_MS: 1000,
    SCORE_THRESHOLD: 3,
    LOCK_PAIR_WINDOW_MS: 2000,
    REASSERT_WINDOW_MS: 3000,
    CHIP_TTL_MS: 5000,
    MAX_EVENTS_PER_PAGE: 10,
    MAX_REBLOCKS_PER_SIGNATURE: 3,
    RECENT_WINDOW_MS: 5000,
    MAX_TRAVERSAL_NODES: 400,
    MIN_AREA_FRACTION: 0.25,
    SHEET_MIN_WIDTH_FRACTION: 0.9,
    SHEET_MIN_HEIGHT_FRACTION: 0.2,
    NEAR_FULLSCREEN_FRACTION: 0.8,
    BACKDROP_MIN_COVERAGE: 0.95,
    MIN_OPACITY: 0.05,
    HIGH_Z_INDEX: 1000,
    NAG_KEYWORDS: [
      "newsletter", "subscribe", "signup", "sign-up", "modal", "popup",
      "pop-up", "overlay", "interstitial", "lightbox", "promo", "offer",
      "paywall", "takeover",
    ],
  };

  function passesHardGates(c) {
    if (!c.uninvited || c.isOwnUi || c.alreadyProcessed) return false;
    if (c.position !== "fixed" && c.position !== "sticky") return false;
    if (!c.visible || c.opacity <= CONFIG.MIN_OPACITY) return false;
    const bigEnough =
      c.viewportCoverage >= CONFIG.MIN_AREA_FRACTION ||
      (c.widthFraction >= CONFIG.SHEET_MIN_WIDTH_FRACTION &&
        c.heightFraction >= CONFIG.SHEET_MIN_HEIGHT_FRACTION);
    if (!bigEnough) return false;
    // Elements already present when we injected are page furniture (app
    // shells, maps, editors). They must show intent to nag, not just shape.
    if (c.preexisting && !(c.hasDialogSemantics || c.keywordHit)) return false;
    return true;
  }

  function softScore(c) {
    let score = 0;
    if (c.scrollLockNearby) score += 2;
    if (c.hasDialogSemantics) score += 2;
    if (c.hasBackdrop) score += 2;
    if (c.hasTextInput || c.autofocusSeen) score += 2;
    if (typeof c.zIndex === "number" && c.zIndex >= CONFIG.HIGH_Z_INDEX) score += 1;
    if (c.keywordHit) score += 1;
    if (c.viewportCoverage >= CONFIG.NEAR_FULLSCREEN_FRACTION) score += 1;
    return score;
  }

  function shouldBlock(c) {
    return passesHardGates(c) && softScore(c) >= CONFIG.SCORE_THRESHOLD;
  }

  function isUninvited(appearedTs, lastGestureTs) {
    return appearedTs - lastGestureTs > CONFIG.GESTURE_WINDOW_MS;
  }

  function normalizeHost(hostname) {
    if (typeof hostname !== "string") return "";
    const h = hostname.toLowerCase();
    return h.startsWith("www.") ? h.slice(4) : h;
  }

  function keywordHit(text) {
    const t = String(text || "").toLowerCase();
    return CONFIG.NAG_KEYWORDS.some((k) => t.includes(k));
  }

  return { CONFIG, passesHardGates, softScore, shouldBlock, isUninvited, normalizeHost, keywordHit };
})();

if (typeof module !== "undefined" && module.exports) module.exports = NaglessScoring;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/common/scoring.js test/unit/scoring.test.mjs
git commit -m "Add pure scoring module with unit tests"
```

---

### Task 3: Fixture pages + dev server

**Files:**
- Create: `test/fixtures/serve.mjs`
- Create: `test/fixtures/{scroll-modal,timed-modal,fixed-body-lock,autofocus-email,display-toggle,late-injection,cookie-banner,user-modal}.html`

**Interfaces:**
- Consumes: nothing.
- Produces: HTTP fixtures on `http://127.0.0.1:8907/<name>.html` used by e2e (Task 5/6) and manual/Android testing. Stable element ids the e2e suite asserts on: `#nag` (the overlay to block), `#backdrop` (where present), `#open-modal` (user-modal's button), `#banner` (cookie-banner). Every fixture has ≥ 30 paragraphs so pages scroll.

- [ ] **Step 1: Write `test/fixtures/serve.mjs`**

```js
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, extname, normalize } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const PORT = 8907;
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css" };

createServer(async (req, res) => {
  try {
    const path = normalize(new URL(req.url, "http://x").pathname).replace(/^([/\\])+/, "");
    const file = join(root, path === "" || path === "." ? "index.html" : path);
    if (!file.startsWith(root)) throw new Error("traversal");
    const body = await readFile(file);
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404); res.end("not found");
  }
}).listen(PORT, "127.0.0.1", () => console.log(`fixtures: http://127.0.0.1:${PORT}`));
```

- [ ] **Step 2: Write the eight fixtures.** Shared skeleton for all (vary only title + the `<script>`/extra markup as specified per fixture):

```html
<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>FIXTURE TITLE</title>
<style>
  body { font: 18px/1.6 system-ui, sans-serif; margin: 0 auto; max-width: 40em; padding: 1em; }
  .modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
           width: min(90vw, 480px); min-height: 40vh; background: #fff; z-index: 9999;
           border-radius: 12px; padding: 24px; box-shadow: 0 8px 40px rgba(0,0,0,.4); }
  .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.55); z-index: 9998; }
</style></head><body>
<h1>FIXTURE TITLE</h1>
<div id="content"></div>
<script>
  document.getElementById("content").innerHTML =
    Array.from({length: 34}, (_, i) => `<p>Paragraph ${i + 1}. Scroll on, reader. Nothing to see here but honest text that keeps the page tall enough to scroll comfortably on any device.</p>`).join("");
</script>
<!-- FIXTURE-SPECIFIC SCRIPT GOES HERE -->
</body></html>
```

Fixture-specific parts (append where marked; each fixture is a full standalone copy of the skeleton with these deltas):

**`scroll-modal.html`** — title "Scroll-triggered newsletter modal". MUST BE BLOCKED.
```html
<script>
  let shown = false;
  addEventListener("scroll", () => {
    if (shown || scrollY < 600) return;
    shown = true;
    const b = document.createElement("div"); b.className = "backdrop"; b.id = "backdrop";
    const m = document.createElement("div"); m.className = "modal newsletter-signup"; m.id = "nag";
    m.innerHTML = '<h2>Join our newsletter!</h2><p>Get our best stories.</p><input type="email" placeholder="you@example.com"><button>Subscribe</button>';
    document.body.append(b, m);
    document.body.style.overflow = "hidden";
  }, { passive: true });
</script>
```

**`timed-modal.html`** — title "Timed interstitial". MUST BE BLOCKED.
```html
<script>
  setTimeout(() => {
    const m = document.createElement("div");
    m.id = "nag";
    m.className = "promo-interstitial";
    m.style.cssText = "position:fixed;inset:0;background:#123;color:#fff;z-index:99999;display:flex;align-items:center;justify-content:center;flex-direction:column;";
    m.innerHTML = "<h2>Special offer!</h2><p>Before you read on…</p><button>Claim</button>";
    document.body.append(m);
    document.documentElement.style.overflow = "hidden";
  }, 1500);
</script>
```

**`fixed-body-lock.html`** — title "Body-fixed scroll lock". MUST BE BLOCKED + scroll position restored.
```html
<script>
  setTimeout(() => {
    const y = scrollY;
    const b = document.createElement("div"); b.className = "backdrop"; b.id = "backdrop";
    const m = document.createElement("div"); m.className = "modal subscribe-box"; m.id = "nag";
    m.innerHTML = '<h2>Sign up for alerts</h2><input type="email" placeholder="Email">';
    document.body.append(b, m);
    document.body.style.position = "fixed";
    document.body.style.top = `-${y}px`;
    document.body.style.width = "100%";
  }, 1500);
</script>
```

**`autofocus-email.html`** — title "Autofocusing email nag". MUST BE BLOCKED + focus blurred (the Android-keyboard case).
```html
<script>
  let shown = false;
  addEventListener("scroll", () => {
    if (shown || scrollY < 600) return;
    shown = true;
    const b = document.createElement("div"); b.className = "backdrop"; b.id = "backdrop";
    const m = document.createElement("div"); m.className = "modal email-capture"; m.id = "nag";
    m.innerHTML = '<h2>Email alerts</h2><input id="email" type="email" placeholder="you@example.com">';
    document.body.append(b, m);
    document.body.style.overflow = "hidden";
    document.getElementById("email").focus();
  }, { passive: true });
</script>
```

**`display-toggle.html`** — title "Display-toggled modal". Modal exists from load, hidden; un-hidden later. MUST BE BLOCKED.
```html
<div id="nag" class="modal newsletter-signup" style="display:none">
  <h2>Don't miss out</h2><input type="email" placeholder="Email"><button>Join</button>
</div>
<script>
  setTimeout(() => {
    document.getElementById("nag").style.display = "block";
    document.body.style.overflow = "hidden";
  }, 1500);
</script>
```

**`late-injection.html`** — title "Late nested injection". Fixed modal sits levels deep in an injected plain wrapper (exercises descendant traversal). MUST BE BLOCKED.
```html
<script>
  setTimeout(() => {
    const wrap = document.createElement("div");
    wrap.innerHTML = '<div><section><div id="nag" class="modal signup-overlay" role="dialog" aria-modal="true"><h2>Subscribe today</h2><input type="text" placeholder="Name"></div></section></div>';
    document.body.append(wrap);
  }, 3000);
</script>
```

**`cookie-banner.html`** — title "Small cookie banner". MUST **NOT** BE BLOCKED (small, no lock).
```html
<div id="banner" style="position:fixed;left:0;right:0;bottom:0;background:#222;color:#fff;padding:16px;z-index:5000;">
  We use cookies. <button>OK</button>
</div>
```

**`user-modal.html`** — title "User-opened modal". MUST **NOT** BE BLOCKED (invited).
```html
<button id="open-modal" style="position:sticky;top:8px;">Open settings</button>
<script>
  document.getElementById("open-modal").addEventListener("click", () => {
    const b = document.createElement("div"); b.className = "backdrop"; b.id = "backdrop";
    const m = document.createElement("div"); m.className = "modal"; m.id = "nag";
    m.innerHTML = '<h2>Settings</h2><input type="text" placeholder="Display name"><button>Save</button>';
    document.body.append(b, m);
    document.body.style.overflow = "hidden";
  });
</script>
```
(Note: `#open-modal` must be inserted right after `<h1>`, before the content div, so it's visible without scrolling.)

- [ ] **Step 3: Verify the server serves every fixture**

Run: `node test/fixtures/serve.mjs & sleep 1 && for f in scroll-modal timed-modal fixed-body-lock autofocus-email display-toggle late-injection cookie-banner user-modal; do curl -sf -o /dev/null -w "$f %{http_code}\n" http://127.0.0.1:8907/$f.html; done; kill %1`
Expected: eight lines, all `200`.

- [ ] **Step 4: Commit**

```bash
git add test/fixtures/
git commit -m "Add nag-pattern fixture pages and local fixture server"
```

---

### Task 4: Manifests, build script, background, skeleton content/popup

**Files:**
- Create: `manifest.firefox.json`, `manifest.chrome.json`
- Create: `tools/build.mjs`
- Create: `src/background.js`
- Create: `src/content/content.js` (skeleton — replaced in Task 6)
- Create: `src/popup/popup.html`, `src/popup/popup.css`, `src/popup/popup.js` (skeletons — completed in Task 7)

**Interfaces:**
- Consumes: icons from Task 1, `common/scoring.js` from Task 2.
- Produces: `npm run build` → `dist/firefox/`, `dist/chrome/` (+ `dist/nagless-<target>-1.0.0.zip`); background message contract: content sends `{type: "nagless:blocked", count: 1}`; `storage.local` keys `{enabled: boolean, allowlist: string[], totalBlocked: number}`; `storage.session` key `tab:<tabId>` = per-tab block count. Task 6/7 rely on these names exactly.

- [ ] **Step 1: Write `manifest.firefox.json`**

```json
{
  "manifest_version": 3,
  "name": "Nagless",
  "version": "1.0.0",
  "description": "Hides uninvited popups — newsletter nags, scroll-triggered overlays, timed interstitials. Unlocks scrolling and dismisses the keyboard they pop open.",
  "browser_specific_settings": {
    "gecko": { "id": "muhannad.dev@gmail.com", "strict_min_version": "140.0" },
    "gecko_android": { "strict_min_version": "142.0" }
  },
  "icons": { "16": "icons/icon-16.png", "32": "icons/icon-32.png", "48": "icons/icon-48.png", "96": "icons/icon-96.png", "128": "icons/icon-128.png" },
  "permissions": ["storage"],
  "host_permissions": ["<all_urls>"],
  "background": { "scripts": ["background.js"] },
  "content_scripts": [
    { "matches": ["<all_urls>"], "js": ["common/scoring.js", "content/content.js"], "run_at": "document_idle" }
  ],
  "action": {
    "default_title": "Nagless",
    "default_popup": "popup/popup.html",
    "default_icon": { "16": "icons/icon-16.png", "32": "icons/icon-32.png", "48": "icons/icon-48.png" }
  }
}
```

- [ ] **Step 2: Write `manifest.chrome.json`** — identical except: no `browser_specific_settings`; `"background": { "service_worker": "background.js" }`; add `"minimum_chrome_version": "121"`.

```json
{
  "manifest_version": 3,
  "name": "Nagless",
  "version": "1.0.0",
  "description": "Hides uninvited popups — newsletter nags, scroll-triggered overlays, timed interstitials. Unlocks scrolling and dismisses the keyboard they pop open.",
  "minimum_chrome_version": "121",
  "icons": { "16": "icons/icon-16.png", "32": "icons/icon-32.png", "48": "icons/icon-48.png", "96": "icons/icon-96.png", "128": "icons/icon-128.png" },
  "permissions": ["storage"],
  "host_permissions": ["<all_urls>"],
  "background": { "service_worker": "background.js" },
  "content_scripts": [
    { "matches": ["<all_urls>"], "js": ["common/scoring.js", "content/content.js"], "run_at": "document_idle" }
  ],
  "action": {
    "default_title": "Nagless",
    "default_popup": "popup/popup.html",
    "default_icon": { "16": "icons/icon-16.png", "32": "icons/icon-32.png", "48": "icons/icon-48.png" }
  }
}
```

- [ ] **Step 3: Write `tools/build.mjs`**

```js
import { cpSync, rmSync, mkdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
rmSync(dist, { recursive: true, force: true });

for (const target of ["firefox", "chrome"]) {
  const manifestPath = join(root, `manifest.${target}.json`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")); // validates JSON
  const out = join(dist, target);
  mkdirSync(out, { recursive: true });
  cpSync(join(root, "src"), out, { recursive: true });
  cpSync(manifestPath, join(out, "manifest.json"));
  const zipName = `nagless-${target}-${manifest.version}.zip`;
  const zip = spawnSync("zip", ["-r", "-X", "-q", join(dist, zipName), "."], { cwd: out });
  if (zip.status !== 0) {
    console.error(zip.stderr?.toString() || "zip failed (is the `zip` CLI installed?)");
    process.exit(1);
  }
  console.log(`built dist/${target} and dist/${zipName}`);
}
```

- [ ] **Step 4: Write `src/background.js`** (complete — this is its final form)

```js
"use strict";
const api = globalThis.browser ?? globalThis.chrome;

api.runtime.onInstalled.addListener(async () => {
  const defaults = { enabled: true, allowlist: [], totalBlocked: 0 };
  const current = await api.storage.local.get(defaults);
  await api.storage.local.set(current); // persists defaults for any missing keys
});

api.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type === "nagless:blocked" && sender.tab?.id != null) {
    recordBlock(sender.tab.id, msg.count ?? 1);
  }
});

async function recordBlock(tabId, count) {
  const key = `tab:${tabId}`;
  const session = await api.storage.session.get({ [key]: 0 });
  const tabTotal = session[key] + count;
  await api.storage.session.set({ [key]: tabTotal });
  const { totalBlocked } = await api.storage.local.get({ totalBlocked: 0 });
  await api.storage.local.set({ totalBlocked: totalBlocked + count });
  await setBadge(tabId, tabTotal);
}

async function setBadge(tabId, n) {
  // Firefox for Android has an action but no badge surface; calls are no-ops
  // or may reject — never let that break the message handler.
  try {
    await api.action.setBadgeBackgroundColor({ tabId, color: "#4F46E5" });
    await api.action.setBadgeText({ tabId, text: n > 0 ? String(n) : "" });
  } catch { /* badge unsupported here */ }
}

api.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === "loading") {
    api.storage.session.remove(`tab:${tabId}`);
    setBadge(tabId, 0);
  }
});

api.tabs.onRemoved.addListener((tabId) => {
  api.storage.session.remove(`tab:${tabId}`);
});
```

- [ ] **Step 5: Write skeleton `src/content/content.js`** (placeholder so builds/lint pass; Task 6 replaces it entirely)

```js
"use strict";
// Nagless content script — full engine lands in Task 6.
// NaglessScoring is available from common/scoring.js (loaded first).
```

- [ ] **Step 6: Write skeleton popup.** `src/popup/popup.html`:

```html
<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="popup.css">
</head><body>
<main id="app"><h1>Nagless</h1><p id="status">Loading…</p></main>
<script src="popup.js"></script>
</body></html>
```

`src/popup/popup.css`:

```css
body { font: 14px/1.4 system-ui, sans-serif; margin: 0; min-width: 260px; }
main { padding: 12px; }
```

`src/popup/popup.js`:

```js
"use strict";
// Full popup logic lands in Task 7.
document.getElementById("status").textContent = "Under construction";
```

- [ ] **Step 7: Build and lint**

Run: `npm run build && unzip -l dist/nagless-firefox-1.0.0.zip && npm run lint`
Expected: both dist trees + zips; zip listing shows `manifest.json`, `background.js`, `common/scoring.js`, `content/content.js`, `popup/popup.html`, `icons/icon-128.png` (among others); `web-ext lint` reports **0 errors** (warnings acceptable — record any).

- [ ] **Step 8: Commit**

```bash
git add manifest.firefox.json manifest.chrome.json tools/build.mjs src/
git commit -m "Add per-store MV3 manifests, build script, background, and skeletons"
```

---

### Task 5: E2E harness + failing suite (red)

**Files:**
- Create: `playwright.config.mjs`
- Create: `test/e2e/nagless.spec.mjs`

**Interfaces:**
- Consumes: fixtures/ids from Task 3 (`#nag`, `#backdrop`, `#open-modal`, `#banner`, port 8907), `dist/chrome` from Task 4's build.
- Produces: the acceptance suite Task 6 must turn green. Chip selectors it fixes for Task 6: host `[data-nagless-ui]`, an open shadow root containing `button#nagless-undo`.

- [ ] **Step 1: Write `playwright.config.mjs`**

```js
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "test/e2e",
  timeout: 30_000,
  retries: 0,
  workers: 1, // one persistent browser context with the extension loaded
  use: { baseURL: "http://127.0.0.1:8907" },
  webServer: {
    command: "node test/fixtures/serve.mjs",
    port: 8907,
    reuseExistingServer: true,
  },
});
```

- [ ] **Step 2: Write `test/e2e/nagless.spec.mjs`**

```js
import { test, expect, chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const distChrome = join(dirname(fileURLToPath(import.meta.url)), "../../dist/chrome");
let context;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    args: [`--disable-extensions-except=${distChrome}`, `--load-extension=${distChrome}`],
  });
  if (context.serviceWorkers().length === 0) await context.waitForEvent("serviceworker");
});
test.afterAll(async () => await context.close());

async function openFixture(name) {
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:8907/${name}.html`);
  return page;
}
const chipUndo = (page) => page.locator("[data-nagless-ui] #nagless-undo");

test("scroll-triggered modal is hidden, scroll unlocked, chip shown", async () => {
  const page = await openFixture("scroll-modal");
  await page.evaluate(() => window.scrollTo(0, 800)); // programmatic: not a gesture
  await expect(page.locator("#nag")).toBeHidden({ timeout: 5000 });
  await expect(page.locator("#backdrop")).toBeHidden();
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe("hidden");
  await expect(chipUndo(page)).toBeVisible();
  await page.close();
});

test("timed interstitial is hidden", async () => {
  const page = await openFixture("timed-modal");
  await expect(page.locator("#nag")).toBeHidden({ timeout: 6000 });
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe("hidden");
  await page.close();
});

test("body-fixed lock variant: hidden and scroll position restored", async () => {
  const page = await openFixture("fixed-body-lock");
  await page.evaluate(() => window.scrollTo(0, 700));
  await expect(page.locator("#nag")).toBeHidden({ timeout: 6000 });
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).position)).not.toBe("fixed");
  const y = await page.evaluate(() => window.scrollY);
  expect(Math.abs(y - 700)).toBeLessThan(60);
  await page.close();
});

test("autofocused email nag: hidden and focus blurred (keyboard case)", async () => {
  const page = await openFixture("autofocus-email");
  await page.evaluate(() => window.scrollTo(0, 800));
  await expect(page.locator("#nag")).toBeHidden({ timeout: 5000 });
  const active = await page.evaluate(() => document.activeElement.tagName);
  expect(active).toBe("BODY");
  await page.close();
});

test("display-toggled modal (pre-existing node) is hidden", async () => {
  const page = await openFixture("display-toggle");
  await expect(page.locator("#nag")).toBeHidden({ timeout: 6000 });
  await page.close();
});

test("late nested injection is found and hidden", async () => {
  const page = await openFixture("late-injection");
  await expect(page.locator("#nag")).toBeHidden({ timeout: 8000 });
  await page.close();
});

test("small cookie banner is NOT touched", async () => {
  const page = await openFixture("cookie-banner");
  await page.waitForTimeout(2500);
  await expect(page.locator("#banner")).toBeVisible();
  await page.close();
});

test("user-opened modal is NOT touched (invited)", async () => {
  const page = await openFixture("user-modal");
  await page.click("#open-modal");
  await page.waitForTimeout(2000);
  await expect(page.locator("#nag")).toBeVisible();
  await page.close();
});

test("undo restores the popup and pauses blocking in the tab", async () => {
  const page = await openFixture("scroll-modal");
  await page.evaluate(() => window.scrollTo(0, 800));
  await expect(chipUndo(page)).toBeVisible({ timeout: 5000 });
  await chipUndo(page).click();
  await expect(page.locator("#nag")).toBeVisible();
  await page.waitForTimeout(1500); // re-block would fire well within this
  await expect(page.locator("#nag")).toBeVisible();
  await page.close();
});

test("background recorded blocks in storage", async () => {
  const worker = context.serviceWorkers()[0];
  const total = await worker.evaluate(async () => (await chrome.storage.local.get({ totalBlocked: 0 })).totalBlocked);
  expect(total).toBeGreaterThan(0);
});
```

- [ ] **Step 3: Run to verify the suite is red for the right reason**

Run: `npm run e2e`
Expected: FAIL — blocking assertions fail (`#nag` stays visible) because content.js is a skeleton; the two "NOT touched" tests and setup pass. No config/launch errors. Do **not** commit yet — Task 6 commits the suite together with the engine that satisfies it.

---

### Task 6: Content engine (turn the suite green)

**Files:**
- Rewrite: `src/content/content.js` (full engine below)
- Modify: `docs/SPEC.md` §5.1 (gestures = `click` + interactive-target `keydown`) and §6 (open shadow root) — the two refinements listed under Global Constraints.

**Interfaces:**
- Consumes: `NaglessScoring` API exactly as produced by Task 2; storage keys and the `{type:"nagless:blocked", count:1}` message from Task 4; chip selectors fixed by Task 5 (`[data-nagless-ui]`, `#nagless-undo`).
- Produces: the shipped detection engine.

- [ ] **Step 1: Replace `src/content/content.js` with the full engine**

```js
"use strict";
// Nagless content engine. Depends on the NaglessScoring global (common/scoring.js).
(() => {
  const api = globalThis.browser ?? globalThis.chrome;
  const S = NaglessScoring;
  const C = S.CONFIG;
  const OWN_ATTR = "data-nagless-ui";
  const CANDIDATE_TAGS = new Set(["DIV", "SECTION", "ASIDE", "DIALOG", "FORM", "ARTICLE"]);

  const state = {
    armed: false,
    paused: false,               // set by Undo; lasts until next page load
    lastGestureTs: -Infinity,
    lock: { locked: false, ts: -Infinity },
    reassertUntil: 0,
    reassertBudget: 5,
    recent: [],                  // [{el, ts}] candidates seen appearing recently
    appearTs: new WeakMap(),     // Element -> first-visible timestamp
    preexisting: new WeakSet(),  // Elements visible at injection time
    hidden: new Map(),           // Element -> {display, priority} prior inline value
    unlockRestores: [],          // [{el, prop, value, priority}] prior inline values we overrode
    signatures: new Map(),       // signature -> block count
    events: 0,
    queue: new Set(),
    rafPending: false,
    observer: null,
    chip: null,                  // {host, timer, count}
  };

  const now = () => performance.now();
  const host = () => S.normalizeHost(location.hostname);

  // ---------- lifecycle ----------

  async function init() {
    if (window.top !== window) return; // top frame only (spec §3.3)
    listenForGestures();
    api.storage.onChanged.addListener(onStorageChanged);
    await syncEnabled(true);
  }

  async function syncEnabled(isStartup) {
    const cfg = await api.storage.local.get({ enabled: true, allowlist: [] });
    const shouldRun = cfg.enabled && !cfg.allowlist.includes(host()) && !state.paused;
    if (shouldRun && !state.armed) arm(isStartup === true);
    else if (!shouldRun && state.armed) { disarm(); restoreAll(); }
  }

  function onStorageChanged(changes, area) {
    if (area === "local" && (changes.enabled || changes.allowlist)) syncEnabled(false);
  }

  function arm(isStartup) {
    state.armed = true;
    if (!state.observer) state.observer = new MutationObserver(onMutations);
    state.observer.observe(document.documentElement, {
      childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"],
    });
    state.lock = { locked: computeLocked(), ts: -Infinity };
    initialSweep(isStartup);
  }

  function disarm() {
    state.armed = false;
    state.observer?.disconnect();
    state.queue.clear();
  }

  // ---------- gestures (spec §5.1: click anywhere, keydown on interactive targets) ----------

  function listenForGestures() {
    window.addEventListener("click", () => { state.lastGestureTs = now(); }, { capture: true, passive: true });
    window.addEventListener("keydown", (e) => {
      const t = e.target;
      if (t instanceof Element &&
          (t.closest("a,button,input,select,textarea,summary,[tabindex],[contenteditable]") !== null)) {
        state.lastGestureTs = now();
      }
    }, { capture: true, passive: true });
  }

  // ---------- observation ----------

  function onMutations(mutations) {
    for (const m of mutations) {
      if (m.type === "childList") {
        for (const n of m.addedNodes) if (n instanceof Element) state.queue.add(n);
      } else if (m.type === "attributes" && m.target instanceof Element) {
        const t = m.target;
        if (t === document.documentElement || t === document.body) { onRootAttrChanged(); continue; }
        state.queue.add(t);
      }
    }
    if (state.queue.size > 0) schedule();
  }

  function schedule() {
    if (state.rafPending) return;
    state.rafPending = true;
    requestAnimationFrame(flush);
  }

  function flush() {
    state.rafPending = false;
    if (!state.armed) { state.queue.clear(); return; }
    const roots = [...state.queue];
    state.queue.clear();
    const candidates = new Set();
    for (const el of roots) collectCandidates(el, candidates);
    for (const el of candidates) evaluate(el);
    pruneRecent();
  }

  function collectCandidates(root, out) {
    if (!(root instanceof Element) || !root.isConnected) return;
    if (root.closest(`[${OWN_ATTR}]`)) return;
    consider(root, out);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let visited = 0;
    for (let el = walker.nextNode(); el && visited < C.MAX_TRAVERSAL_NODES; el = walker.nextNode()) {
      visited += 1;
      consider(el, out);
    }
  }

  function consider(el, out) {
    if (CANDIDATE_TAGS.has(el.tagName) || el.hasAttribute("role") || el.hasAttribute("aria-modal")) out.add(el);
  }

  // ---------- evaluation ----------

  function evaluate(el) {
    if (!el.isConnected) return;
    if (state.hidden.has(el)) { reassertHide(el); return; }
    const cs = getComputedStyle(el);
    if (cs.position !== "fixed" && cs.position !== "sticky") return;

    const vw = window.innerWidth, vh = window.innerHeight;
    const rect = el.getBoundingClientRect();
    const interW = Math.max(0, Math.min(rect.right, vw) - Math.max(rect.left, 0));
    const interH = Math.max(0, Math.min(rect.bottom, vh) - Math.max(rect.top, 0));
    const coverage = vw && vh ? (interW * interH) / (vw * vh) : 0;
    const visible = cs.display !== "none" && cs.visibility === "visible" && interW > 0 && interH > 0;
    const opacity = parseFloat(cs.opacity);
    if (!visible) return;

    let appearedTs = state.appearTs.get(el);
    if (appearedTs === undefined) {
      appearedTs = now();
      state.appearTs.set(el, appearedTs);
      state.recent.push({ el, ts: appearedTs });
    }

    const zIndex = Number.isNaN(parseInt(cs.zIndex, 10)) ? null : parseInt(cs.zIndex, 10);
    const backdropEl = findBackdrop(el, vw, vh);
    const classText = `${el.id} ${String(el.className)} ${childClassText(el)}`;

    const candidate = {
      uninvited: S.isUninvited(appearedTs, state.lastGestureTs),
      isOwnUi: false,
      alreadyProcessed: false,
      preexisting: state.preexisting.has(el),
      position: cs.position,
      visible,
      opacity: Number.isNaN(opacity) ? 1 : opacity,
      viewportCoverage: coverage,
      widthFraction: interW / (vw || 1),
      heightFraction: interH / (vh || 1),
      zIndex,
      hasDialogSemantics:
        el.matches('dialog,[role="dialog"],[role="alertdialog"],[aria-modal="true"]') ||
        el.querySelector(':scope > dialog, :scope > [role="dialog"], :scope > [aria-modal="true"]') !== null,
      hasTextInput: el.querySelector('input[type="email"], input[type="text"], input:not([type]), textarea') !== null,
      autofocusSeen: el.contains(document.activeElement) && document.activeElement !== document.body,
      keywordHit: S.keywordHit(classText),
      hasBackdrop: backdropEl !== null,
      scrollLockNearby: lockNearby(appearedTs),
    };

    if (S.shouldBlock(candidate)) block(el, backdropEl);
  }

  function childClassText(el) {
    let text = "";
    let count = 0;
    for (const child of el.children) {
      if (count >= 5) break;
      text += ` ${child.id} ${String(child.className)}`;
      count += 1;
    }
    return text;
  }

  function findBackdrop(el, vw, vh) {
    const near = [el.previousElementSibling, el.nextElementSibling, el.parentElement];
    for (const cand of near) {
      if (!cand || cand === el || cand.closest(`[${OWN_ATTR}]`)) continue;
      const cs = getComputedStyle(cand);
      if (cs.position !== "fixed") continue;
      const r = cand.getBoundingClientRect();
      const covers = r.width >= vw * C.BACKDROP_MIN_COVERAGE && r.height >= vh * C.BACKDROP_MIN_COVERAGE;
      if (!covers) continue;
      if (cs.backdropFilter !== "none" || backgroundAlpha(cs.backgroundColor) > 0.05) return cand;
    }
    return null;
  }

  function backgroundAlpha(color) {
    const m = /rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*([\d.]+)\s*)?\)/.exec(color || "");
    if (!m) return 0;
    return m[1] === undefined ? 1 : parseFloat(m[1]);
  }

  function initialSweep(isStartup) {
    const out = new Set();
    collectCandidates(document.body ?? document.documentElement, out);
    if (isStartup) {
      // Whatever is fixed/visible at injection time is page furniture unless
      // it *announces* nag intent — mark it so scoring demands dialog/keyword.
      for (const el of out) state.preexisting.add(el);
    }
    for (const el of out) evaluate(el);
  }

  // ---------- scroll lock tracking ----------

  function computeLocked() {
    const b = document.body ? getComputedStyle(document.body) : null;
    const h = getComputedStyle(document.documentElement);
    return (
      h.overflow === "hidden" || h.overflowY === "hidden" ||
      (b !== null && (b.overflow === "hidden" || b.overflowY === "hidden" || b.position === "fixed"))
    );
  }

  function onRootAttrChanged() {
    const lockedNow = computeLocked();
    if (lockedNow === state.lock.locked) return;
    state.lock = { locked: lockedNow, ts: now() };
    if (!lockedNow) return;
    if (now() < state.reassertUntil && state.reassertBudget > 0) {
      // Site re-asserted its lock right after a block — undo it again, bounded.
      state.reassertBudget -= 1;
      unlockScroll();
      return;
    }
    if (S.isUninvited(now(), state.lastGestureTs)) {
      // A lock landed uninvited: re-examine what appeared recently — the
      // overlay may have been inserted a beat before its lock.
      pruneRecent();
      for (const { el } of state.recent) state.queue.add(el);
      if (state.queue.size > 0) schedule();
    }
  }

  function lockNearby(appearedTs) {
    if (!state.lock.locked) return false;
    if (Math.abs(state.lock.ts - appearedTs) <= C.LOCK_PAIR_WINDOW_MS) return true;
    return state.lock.ts === -Infinity && now() - appearedTs <= C.LOCK_PAIR_WINDOW_MS;
  }

  function pruneRecent() {
    const cutoff = now() - C.RECENT_WINDOW_MS;
    state.recent = state.recent.filter((r) => r.ts >= cutoff && r.el.isConnected);
  }

  // ---------- actions ----------

  function block(el, backdropEl) {
    if (state.events >= C.MAX_EVENTS_PER_PAGE) return;
    const sig = signatureOf(el);
    const nth = (state.signatures.get(sig) ?? 0) + 1;
    state.signatures.set(sig, nth);
    const silent = nth > C.MAX_REBLOCKS_PER_SIGNATURE;

    const targets = [el];
    if (backdropEl && backdropEl !== el) targets.push(backdropEl);

    const active = document.activeElement;
    if (active && targets.some((t) => t.contains(active))) active.blur(); // dismisses mobile keyboard

    for (const t of targets) hideEl(t);
    unlockScroll();
    state.reassertUntil = now() + C.REASSERT_WINDOW_MS;

    if (!silent) {
      state.events += 1;
      try { api.runtime.sendMessage({ type: "nagless:blocked", count: 1 }); } catch { /* bg asleep/unavailable */ }
      showChip();
    }
  }

  function signatureOf(el) {
    const classes = String(el.className).split(/\s+/).filter(Boolean).slice(0, 2).join(".");
    return `${el.tagName}#${el.id}.${classes}`;
  }

  function hideEl(el) {
    if (state.hidden.has(el)) { reassertHide(el); return; }
    state.hidden.set(el, {
      value: el.style.getPropertyValue("display"),
      priority: el.style.getPropertyPriority("display"),
    });
    el.style.setProperty("display", "none", "important");
  }

  function reassertHide(el) { // site JS flipped display back on — quietly re-hide
    if (el.style.getPropertyValue("display") !== "none") {
      el.style.setProperty("display", "none", "important");
    }
  }

  function unlockScroll() {
    const doc = document.documentElement;
    const body = document.body;
    if (!body) return;
    const bodyCs = getComputedStyle(body);
    const docCs = getComputedStyle(doc);
    let scrollTarget = null;

    if (bodyCs.position === "fixed") {
      const top = parseInt(bodyCs.top, 10);
      if (!Number.isNaN(top) && top < 0) scrollTarget = -top;
      override(body, "position", "static");
      override(body, "top", "auto");
    }
    for (const [el, cs] of [[doc, docCs], [body, bodyCs]]) {
      if (cs.overflow === "hidden" || cs.overflowY === "hidden") {
        override(el, "overflow", "auto");
        override(el, "overflow-y", "auto");
      }
    }
    if (scrollTarget !== null) window.scrollTo(0, scrollTarget);
  }

  function override(el, prop, value) {
    state.unlockRestores.push({
      el, prop,
      value: el.style.getPropertyValue(prop),
      priority: el.style.getPropertyPriority(prop),
    });
    el.style.setProperty(prop, value, "important");
  }

  function restoreAll() {
    for (const [el, prior] of state.hidden) restoreProp(el, "display", prior);
    state.hidden.clear();
    for (let i = state.unlockRestores.length - 1; i >= 0; i -= 1) {
      const { el, prop, value, priority } = state.unlockRestores[i];
      restoreProp(el, prop, { value, priority });
    }
    state.unlockRestores = [];
    removeChip();
  }

  function restoreProp(el, prop, prior) {
    if (prior.value === "" || prior.value === undefined) el.style.removeProperty(prop);
    else el.style.setProperty(prop, prior.value, prior.priority || "");
  }

  // ---------- undo chip (spec §6, open shadow root) ----------

  function showChip() {
    if (state.chip) {
      state.chip.count += 1;
      state.chip.label.textContent = `${state.chip.count} popups blocked`;
      clearTimeout(state.chip.timer);
      state.chip.timer = setTimeout(removeChip, C.CHIP_TTL_MS);
      return;
    }
    const hostEl = document.createElement("div");
    hostEl.setAttribute(OWN_ATTR, "");
    for (const [prop, val] of [
      ["position", "fixed"], ["left", "50%"], ["bottom", "calc(16px + env(safe-area-inset-bottom, 0px))"],
      ["transform", "translateX(-50%)"], ["z-index", "2147483647"],
    ]) hostEl.style.setProperty(prop, val, "important");

    const root = hostEl.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        .pill { display: flex; align-items: center; gap: 12px; background: #1F2430; color: #F4F5F7;
                font: 14px/1 system-ui, sans-serif; border-radius: 999px; padding: 10px 10px 10px 18px;
                box-shadow: 0 4px 24px rgba(0,0,0,.35); white-space: nowrap; }
        button { all: unset; cursor: pointer; background: #4F46E5; color: #fff; font: inherit;
                 font-weight: 600; border-radius: 999px; padding: 10px 16px; min-height: 24px; }
        button:focus-visible { outline: 2px solid #fff; }
        @media (prefers-color-scheme: light) { .pill { background: #23283A; } }
      </style>
      <div class="pill" role="status"><span id="nagless-label">Popup blocked</span>
      <button id="nagless-undo" type="button">Undo</button></div>`;
    root.getElementById("nagless-undo").addEventListener("click", undo);
    document.documentElement.append(hostEl);
    state.chip = {
      host: hostEl,
      label: root.getElementById("nagless-label"),
      count: 1,
      timer: setTimeout(removeChip, C.CHIP_TTL_MS),
    };
  }

  function removeChip() {
    if (!state.chip) return;
    clearTimeout(state.chip.timer);
    state.chip.host.remove();
    state.chip = null;
  }

  function undo() {
    state.paused = true; // until next real page load
    disarm();
    restoreAll();
  }

  init();
})();
```

- [ ] **Step 2: Run the e2e suite; iterate on the engine until green**

Run: `npm run e2e`
Expected: all 11 tests PASS. Debug loop if not: `npm run build && npx playwright test --headed --project=` with `page.pause()` as needed. Common traps checked in review: rAF not firing in background tabs (suite keeps pages foregrounded), `state.lock.ts === -Infinity` path for locks applied before arm, chip click counting as a gesture (harmless — undo pauses anyway).

- [ ] **Step 3: Run unit tests + lint to confirm nothing regressed**

Run: `npm test && npm run lint`
Expected: PASS / 0 errors.

- [ ] **Step 4: Apply the two spec refinements** — edit `docs/SPEC.md`: §5.1 replace the listener list `pointerdown`, `keydown`, `touchstart` with `click` (anywhere) + `keydown` (interactive targets only), adding one sentence of rationale: touch-scrolling begins with `touchstart`, so scrolling must never count as an invitation; §6 change "closed shadow root" to "open shadow root" with the debuggability rationale. §5.2's initial-scan sentence gains: "elements present at injection are flagged `preexisting` and additionally require dialog semantics or a nag keyword."

- [ ] **Step 5: Commit**

```bash
git add src/content/content.js playwright.config.mjs test/e2e/ docs/SPEC.md
git commit -m "Implement content detection engine; e2e suite green"
```

---

### Task 7: Popup UI (complete)

**Files:**
- Rewrite: `src/popup/popup.html`, `src/popup/popup.css`, `src/popup/popup.js`
- Create: `test/e2e/popup.spec.mjs`

**Interfaces:**
- Consumes: storage keys `{enabled, allowlist, totalBlocked}`, session key `tab:<tabId>`, `NaglessScoring.normalizeHost` semantics (popup re-implements the two-line normalize inline — popup pages don't load content scripts).
- Produces: shipped UI. No new interfaces.

- [ ] **Step 1: Write `src/popup/popup.html`**

```html
<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="popup.css">
</head><body>
<main>
  <header><img src="../icons/icon-32.png" alt="" width="20" height="20"><h1>Nagless</h1></header>

  <section id="perm" hidden>
    <p>Nagless needs permission to see pages so it can hide nag popups. Nothing is collected or sent anywhere.</p>
    <button id="grant">Grant access to websites</button>
  </section>

  <section id="controls">
    <label class="row"><span>Enabled</span>
      <input type="checkbox" id="toggle-global" role="switch"></label>
    <label class="row" id="site-row"><span>On <b id="site-host">this site</b></span>
      <input type="checkbox" id="toggle-site" role="switch"></label>
    <p class="counters"><span id="count-tab">0</span> blocked on this page · <span id="count-total">0</span> all-time</p>
  </section>
</main>
<script src="popup.js"></script>
</body></html>
```

- [ ] **Step 2: Write `src/popup/popup.css`**

```css
:root { color-scheme: light dark; }
body { font: 14px/1.45 system-ui, sans-serif; margin: 0; min-width: 264px; }
main { padding: 8px 14px 12px; }
header { display: flex; align-items: center; gap: 8px; padding: 6px 0 10px; }
h1 { font-size: 15px; margin: 0; }
.row { display: flex; align-items: center; justify-content: space-between;
       min-height: 44px; gap: 12px; }
.row input[type="checkbox"] { width: 40px; height: 22px; accent-color: #4F46E5; }
.row[aria-disabled="true"] { opacity: 0.5; pointer-events: none; }
.counters { color: color-mix(in srgb, currentColor 62%, transparent); margin: 8px 0 0; }
#perm p { margin: 4px 0 10px; }
#perm button { width: 100%; min-height: 44px; border: 0; border-radius: 8px;
               background: #4F46E5; color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
b { font-weight: 600; }
```

- [ ] **Step 3: Write `src/popup/popup.js`**

```js
"use strict";
const api = globalThis.browser ?? globalThis.chrome;
const $ = (id) => document.getElementById(id);

function normalizeHost(hostname) {
  const h = (hostname || "").toLowerCase();
  return h.startsWith("www.") ? h.slice(4) : h;
}

async function currentSite() {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return { tab, host: null };
  try {
    const url = new URL(tab.url);
    if (url.protocol !== "http:" && url.protocol !== "https:") return { tab, host: null };
    return { tab, host: normalizeHost(url.hostname) };
  } catch { return { tab, host: null }; }
}

async function refresh() {
  const { tab, host } = await currentSite();
  const cfg = await api.storage.local.get({ enabled: true, allowlist: [], totalBlocked: 0 });

  $("toggle-global").checked = cfg.enabled;
  $("count-total").textContent = String(cfg.totalBlocked);

  const siteRow = $("site-row");
  if (host === null) {
    siteRow.setAttribute("aria-disabled", "true");
    $("site-host").textContent = "this site";
    $("toggle-site").checked = false;
  } else {
    siteRow.removeAttribute("aria-disabled");
    $("site-host").textContent = host;
    $("toggle-site").checked = !cfg.allowlist.includes(host);
  }

  let tabCount = 0;
  if (tab?.id != null) {
    const session = await api.storage.session.get({ [`tab:${tab.id}`]: 0 });
    tabCount = session[`tab:${tab.id}`];
  }
  $("count-tab").textContent = String(tabCount);
}

async function initPermissionGate() {
  const granted = await api.permissions.contains({ origins: ["<all_urls>"] });
  $("perm").hidden = granted;
  if (granted) return;
  $("grant").addEventListener("click", async () => {
    const ok = await api.permissions.request({ origins: ["<all_urls>"] });
    if (ok) $("perm").hidden = true;
  });
}

$("toggle-global").addEventListener("change", async (e) => {
  await api.storage.local.set({ enabled: e.target.checked });
});

$("toggle-site").addEventListener("change", async (e) => {
  const { host } = await currentSite();
  if (host === null) return;
  const { allowlist } = await api.storage.local.get({ allowlist: [] });
  const next = allowlist.filter((h) => h !== host);
  if (!e.target.checked) next.push(host);
  await api.storage.local.set({ allowlist: next });
});

initPermissionGate();
refresh();
```

- [ ] **Step 4: Write `test/e2e/popup.spec.mjs`**

```js
import { test, expect, chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const distChrome = join(dirname(fileURLToPath(import.meta.url)), "../../dist/chrome");
let context, extensionId;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    args: [`--disable-extensions-except=${distChrome}`, `--load-extension=${distChrome}`],
  });
  if (context.serviceWorkers().length === 0) await context.waitForEvent("serviceworker");
  extensionId = new URL(context.serviceWorkers()[0].url()).host;
});
test.afterAll(async () => await context.close());

test("global toggle writes storage.enabled", async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);
  await expect(page.locator("#toggle-global")).toBeChecked();
  await page.locator("#toggle-global").click();
  await expect.poll(async () =>
    page.evaluate(async () => (await chrome.storage.local.get("enabled")).enabled)
  ).toBe(false);
  await page.locator("#toggle-global").click(); // leave enabled for other suites
  await page.close();
});

test("site toggle allowlists the fixture host and content script honors it", async () => {
  const fixture = await context.newPage();
  await fixture.goto("http://127.0.0.1:8907/timed-modal.html");
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);
  // popup page itself is the active tab; site row must be disabled for it
  await expect(popup.locator("#site-row")).toHaveAttribute("aria-disabled", "true");
  // allowlist via storage directly (popup's active tab is itself in this harness)
  await popup.evaluate(async () => { await chrome.storage.local.set({ allowlist: ["127.0.0.1"] }); });
  const fresh = await context.newPage();
  await fresh.goto("http://127.0.0.1:8907/timed-modal.html");
  await fresh.waitForTimeout(2500);
  await expect(fresh.locator("#nag")).toBeVisible(); // allowlisted: untouched
  await popup.evaluate(async () => { await chrome.storage.local.set({ allowlist: [] }); });
  await Promise.all([fixture.close(), popup.close(), fresh.close()]);
});
```

- [ ] **Step 5: Run everything**

Run: `npm run e2e`
Expected: both spec files PASS (13 tests total).

- [ ] **Step 6: Commit**

```bash
git add src/popup/ test/e2e/popup.spec.mjs
git commit -m "Implement popup UI with permission gate, toggles, counters"
```

---

### Task 8: CI + full local gate

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `README.md` (verify the Development section's commands match package.json exactly; fix any drift)

**Interfaces:**
- Consumes: all npm scripts.
- Produces: CI green on push.

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm test
      - run: npm run build
      - run: npx web-ext lint --source-dir dist/firefox
      - run: npx playwright install --with-deps chromium
      - run: npm run e2e
```

- [ ] **Step 2: Full local gate (same order as CI)**

Run: `npm ci && npm test && npm run build && npx web-ext lint --source-dir dist/firefox && npm run e2e`
Expected: every stage passes. This is the verification-before-completion gate for the whole codebase.

- [ ] **Step 3: Reconcile README** — compare `README.md` Development section against `package.json` scripts; correct any mismatch (there should be none).

- [ ] **Step 4: Commit**

```bash
git add .github/ README.md
git commit -m "Add CI workflow running unit, lint, build, and e2e gates"
```

---

### Task 9: Publishing runbook + store listing copy

**Files:**
- Create: `docs/PUBLISHING.md`
- Modify: `README.md` (turn the `docs/PUBLISHING.md` mention into a real link)

**Interfaces:**
- Consumes: nothing from code; summarizes store processes.
- Produces: the exact texts and steps used at submission time.

- [ ] **Step 1: Write `docs/PUBLISHING.md`** containing, at minimum:
  - **Shared listing copy** (verbatim, ready to paste): name `Nagless`; summary (≤ 132 chars for CWS): `Hides uninvited popups — newsletter nags, scroll overlays, timed interstitials. Unlocks scrolling. No lists, no data collection.`; a 3-paragraph description covering what it blocks, the undo/allowlist safety net, and the privacy stance; category: AMO "Privacy & Security", CWS "Tools"/"Productivity".
  - **Permission justification** (both stores ask): `Nagless detects nag overlays structurally on whatever page the user is reading, so it needs to run on all sites (<all_urls> + storage for settings). It makes no network requests, collects nothing, and ships no remote code.`
  - **AMO steps:** create account at addons.mozilla.org → Developer Hub; submit `dist/nagless-firefox-1.0.0.zip` as a **listed** add-on; no minified/generated code so no source-archive upload needed (icons are build artifacts committed as-is — note this in the reviewer notes field); mark Android compatibility (gecko_android present); expect automated signing + human review queue.
  - **CWS steps:** one-time $5 developer registration → dashboard → new item → upload `dist/nagless-chrome-1.0.0.zip`; fill Privacy tab: single purpose = "hide nag/popup overlays on pages the user visits", host permission justification (above), data collection = none; link privacy policy to the repo's `PRIVACY.md` (GitHub URL); expect extended review because of `<all_urls>`.
  - **Screenshot shot-list** (taken from fixtures at 1280×800 + one Android frame): fixture page with nag visible (before) / hidden with chip (after); popup open; Android popup bottom-sheet.
  - **Release procedure:** bump version in BOTH manifests + package.json → `npm run build` → tag `v<version>` → upload both zips; keep AMO and CWS versions identical.
  - **Android install for personal testing before store approval:** `npm run start:android -- --adb-device <id>` (temporary), or AMO **unlisted** signing via `npm run sign` for a permanent sideload xpi.
- [ ] **Step 2: Update README** — link `docs/PUBLISHING.md`, remove the "(written during the publishing phase)" note; same for `docs/IMPLEMENTATION.md`'s "(written next…)" note.
- [ ] **Step 3: Commit**

```bash
git add docs/PUBLISHING.md README.md
git commit -m "Add store publishing runbook and listing copy"
```

---

### Task 10: Manual QA — desktop, then the owner's Android phone

No new files; this is the human gate before submission (spec §11.4–11.5, §12).

- [ ] **Step 1: Desktop Firefox pass** — `npm run fixtures` in one shell; `npm run start:firefox` in another; walk all 8 fixtures at `http://127.0.0.1:8907/`, confirm the §12 behaviors + popup toggles + badge.
- [ ] **Step 2: Chrome pass** — load `dist/chrome` unpacked; spot-check scroll-modal, user-modal, popup.
- [ ] **Step 3: Real-site pass (desktop)** — visit 5 known nag-heavy sites; record results per site in the session notes (block/miss/false-positive).
- [ ] **Step 4: Android session (owner + agent together)** — phone: enable Developer options → USB debugging; install release Firefox; Firefox Settings → Remote debugging via USB. Host: `brew install --cask android-platform-tools` if `adb` missing; `adb devices` to authorize; `adb reverse tcp:8907 tcp:8907` so the phone reaches the fixture server; `npm run fixtures`; `npm run start:android -- --adb-device <ID>`. Walk fixtures on the phone — the autofocus-email fixture is the acceptance test: **no keyboard may appear**. Then the real-site list on the phone.
- [ ] **Step 5: Record results** — append a dated QA log section to `docs/PUBLISHING.md` (sites tested, pass/fail, tuning changes made). Any heuristic tuning goes through Task 2's unit tests + Task 6's e2e, then re-run this task's affected steps.

---

## Plan self-review (completed at write time)

- **Spec coverage:** §5 engine → Tasks 2+6; §6 chip → Task 6; §7 counters/badge → Tasks 4+7; §8 manifests/API pattern → Task 4; §8.3+§9 popup/permission gate → Task 7; §10 layout → Tasks 1–8; §11 tests → Tasks 2,3,5,6,7,8,10; §12 criteria → Tasks 8+10; publishing §11.6/§13 → Task 9. Icons (§8.1) → Task 1. No uncovered spec section.
- **Placeholders:** none — every file's full content is inline except PUBLISHING.md, whose Step 1 enumerates its complete required content, and deliberate skeletons that later tasks rewrite (marked as such).
- **Type consistency:** `NaglessScoring` API names, candidate fields (incl. `preexisting`), storage keys, message type `nagless:blocked`, chip selectors (`data-nagless-ui`, `#nagless-undo`), port 8907, and dist paths cross-checked across Tasks 2/4/5/6/7.
