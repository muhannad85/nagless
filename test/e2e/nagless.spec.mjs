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

// toBeHidden is vacuously true for a not-yet-inserted element; every blocking
// test must first prove the nag actually appeared in the DOM.
async function nagAppears(page, timeout) {
  await page.locator("#nag").waitFor({ state: "attached", timeout });
}

test("scroll-triggered modal is hidden, scroll unlocked, chip shown", async () => {
  const page = await openFixture("scroll-modal");
  await page.evaluate(() => window.scrollTo(0, 800)); // programmatic: not a gesture
  await nagAppears(page, 5000);
  await expect(page.locator("#nag")).toBeHidden({ timeout: 5000 });
  await expect(page.locator("#backdrop")).toBeHidden();
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe("hidden");
  await expect(chipUndo(page)).toBeVisible();
  await page.close();
});

test("timed interstitial is hidden", async () => {
  const page = await openFixture("timed-modal");
  await nagAppears(page, 6000);
  await expect(page.locator("#nag")).toBeHidden({ timeout: 5000 });
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe("hidden");
  await page.close();
});

test("body-fixed lock variant: hidden and scroll position restored", async () => {
  const page = await openFixture("fixed-body-lock");
  await page.evaluate(() => window.scrollTo(0, 700));
  await nagAppears(page, 6000);
  await expect(page.locator("#nag")).toBeHidden({ timeout: 5000 });
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).position)).not.toBe("fixed");
  const y = await page.evaluate(() => window.scrollY);
  expect(Math.abs(y - 700)).toBeLessThan(60);
  await page.close();
});

test("autofocused email nag: hidden and focus blurred (keyboard case)", async () => {
  const page = await openFixture("autofocus-email");
  await page.evaluate(() => window.scrollTo(0, 800));
  await nagAppears(page, 5000);
  await expect(page.locator("#nag")).toBeHidden({ timeout: 5000 });
  const active = await page.evaluate(() => document.activeElement.tagName);
  expect(active).toBe("BODY");
  await page.close();
});

test("display-toggled modal (pre-existing node) is hidden", async () => {
  const page = await openFixture("display-toggle");
  // The node starts display:none, so "hidden" alone would be vacuous. Our hide
  // uses an !important inline display — the fixture never does — so its
  // presence proves Nagless acted after the site un-hid the modal.
  await page.waitForFunction(() => {
    const el = document.getElementById("nag");
    return el !== null && el.style.getPropertyPriority("display") === "important";
  }, undefined, { timeout: 6000 });
  await expect(page.locator("#nag")).toBeHidden();
  await page.close();
});

test("late nested injection is found and hidden", async () => {
  const page = await openFixture("late-injection");
  await nagAppears(page, 8000);
  await expect(page.locator("#nag")).toBeHidden({ timeout: 5000 });
  await page.close();
});

test("logged-out wall (preexisting, obfuscated classes, deep dialog) is hidden", async () => {
  const page = await openFixture("login-wall");
  await nagAppears(page, 3000);
  await expect(page.locator("#nag")).toBeHidden({ timeout: 5000 });
  await expect(chipUndo(page)).toBeVisible();
  await page.close();
});

test("app-shell wall (relative layer + detached fixed dim) is fully cleared", async () => {
  const page = await openFixture("login-wall-desktop");
  await nagAppears(page, 3000);
  await expect(page.locator("#nag")).toBeHidden({ timeout: 5000 });
  await expect(page.locator("#dim")).toBeHidden(); // detached dim swept with the wall
  await expect(chipUndo(page)).toBeVisible();
  // inner scroll container still works
  await page.evaluate(() => document.getElementById("scrollview").scrollTo(0, 400));
  const y = await page.evaluate(() => document.getElementById("scrollview").scrollTop);
  expect(y).toBeGreaterThan(300);
  await page.close();
});

test("wall deep in a large DOM is found (discovery is not truncated)", async () => {
  const page = await openFixture("deep-dom-wall");
  await nagAppears(page, 3000);
  const count = await page.evaluate(() => document.querySelectorAll("*").length);
  expect(count).toBeGreaterThan(1400); // fixture really is SPA-sized
  await expect(page.locator("#nag")).toBeHidden({ timeout: 5000 });
  await page.close();
});

test("gesture-level scroll lock is neutralized (real wheel, not scrollTo)", async () => {
  const page = await openFixture("gesture-lock");
  await nagAppears(page, 4000);
  await expect(page.locator("#nag")).toBeHidden({ timeout: 5000 });
  // window.scrollTo bypasses the page's wheel guard entirely, so it would pass
  // even with scrolling dead. Only a dispatched gesture proves the fix.
  await page.mouse.move(200, 400);
  await page.mouse.wheel(0, 600);
  await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 3000 }).toBeGreaterThan(200);
  await page.close();
});

test("gesture lock over an app shell scrolls the inner container", async () => {
  const page = await openFixture("app-shell-gesture-lock");
  await nagAppears(page, 4000);
  await expect(page.locator("#nag")).toBeHidden({ timeout: 5000 });
  // The document is not the scroller here, so window.scrollBy would be a no-op.
  await page.mouse.move(200, 400);
  await page.mouse.wheel(0, 600);
  await expect.poll(() => page.evaluate(() => document.getElementById("scrollview").scrollTop),
    { timeout: 3000 }).toBeGreaterThan(200);
  await page.close();
});

test("sticky video player is NOT touched despite focus and overlay classes", async () => {
  const page = await openFixture("video-player");
  await page.waitForTimeout(2500); // outlives the 1s programmatic focus
  await expect(page.locator("#player")).toBeVisible();
  await expect(page.locator("#player video")).toBeVisible();
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
