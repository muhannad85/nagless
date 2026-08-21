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
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);
  // The popup page itself is the active tab here (an extension:// URL), so
  // the per-site row must render disabled.
  await expect(popup.locator("#site-row")).toHaveAttribute("aria-disabled", "true");
  // Exercise the allowlist path via storage (what the toggle writes).
  await popup.evaluate(async () => { await chrome.storage.local.set({ allowlist: ["127.0.0.1"] }); });
  const fresh = await context.newPage();
  await fresh.goto("http://127.0.0.1:8907/timed-modal.html");
  await fresh.locator("#nag").waitFor({ state: "attached", timeout: 6000 });
  await fresh.waitForTimeout(1000);
  await expect(fresh.locator("#nag")).toBeVisible(); // allowlisted: untouched
  await popup.evaluate(async () => { await chrome.storage.local.set({ allowlist: [] }); });
  await Promise.all([popup.close(), fresh.close()]);
});
