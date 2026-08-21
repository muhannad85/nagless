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
