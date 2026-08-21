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
