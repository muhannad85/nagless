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
    hidden: new Map(),           // Element -> {value, priority} prior inline display
    unlockRestores: [],          // [{el, prop, value, priority}] prior inline values we overrode
    signatures: new Map(),       // signature -> block count
    events: 0,
    queue: new Set(),
    rafPending: false,
    observer: null,
    chip: null,                  // {host, label, timer, count}
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
          t.closest("a,button,input,select,textarea,summary,[tabindex],[contenteditable]") !== null) {
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
    // Evaluate modal cards before near-fullscreen elements: blocking a
    // backdrop first would zero its rect and rob its card of the backdrop
    // signal. Cards blocked first take their backdrop down with them.
    const ordered = [...candidates].sort((a, b) => quickArea(a) - quickArea(b));
    for (const el of ordered) evaluate(el);
    pruneRecent();
  }

  function quickArea(el) {
    const r = el.getBoundingClientRect();
    return r.width * r.height;
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
    const fixedish = cs.position === "fixed" || cs.position === "sticky";
    if (!fixedish && cs.position === "static") return;

    const vw = window.innerWidth, vh = window.innerHeight;
    const rect = el.getBoundingClientRect();
    const interW = Math.max(0, Math.min(rect.right, vw) - Math.max(rect.left, 0));
    const interH = Math.max(0, Math.min(rect.bottom, vh) - Math.max(rect.top, 0));
    const coverage = vw && vh ? (interW * interH) / (vw * vh) : 0;
    const visible = cs.display !== "none" && cs.visibility === "visible" && interW > 0 && interH > 0;
    if (!visible) return;
    const coversViewport =
      interW / (vw || 1) >= C.WALL_MIN_DIM_FRACTION && interH / (vh || 1) >= C.WALL_MIN_DIM_FRACTION;
    if (!fixedish && !coversViewport) return; // positioned but small: never a wall
    const opacity = parseFloat(cs.opacity);

    let appearedTs = state.appearTs.get(el);
    if (appearedTs === undefined) {
      appearedTs = now();
      state.appearTs.set(el, appearedTs);
      state.recent.push({ el, ts: appearedTs });
    }

    const zIndex = Number.isNaN(parseInt(cs.zIndex, 10)) ? null : parseInt(cs.zIndex, 10);
    const backdropEl = findBackdrop(el, vw, vh);
    const selfText = `${el.id} ${String(el.className)}`;
    const active = document.activeElement;

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
        hasVisibleDialogDescendant(el),
      hasTextInput: el.querySelector('input[type="email"], input[type="text"], input:not([type]), textarea') !== null,
      textInputFocused:
        active instanceof Element && el.contains(active) &&
        active.matches('input[type="email"], input[type="text"], input:not([type]), textarea, [contenteditable="true"]'),
      hasVideo: el.querySelector("video") !== null,
      keywordHit: S.keywordHit(`${selfText} ${childClassText(el)}`),
      keywordHitSelf: S.keywordHit(selfText),
      hasBackdrop: backdropEl !== null,
      scrollLockNearby: lockNearby(appearedTs),
      coversViewport,
      positioned: cs.position !== "static",
    };

    if (S.shouldBlock(candidate)) block(el, backdropEl, candidate.hasDialogSemantics);
  }

  function hasVisibleDialogDescendant(el) {
    // Login/consent walls often nest role="dialog" a few levels inside a
    // plain fixed container (Instagram's logged-out wall). Only *visible*
    // dialogs count — app shells routinely hold hidden dialog templates.
    const matches = el.querySelectorAll('dialog, [role="dialog"], [role="alertdialog"], [aria-modal="true"]');
    let checked = 0;
    for (const d of matches) {
      if (checked >= 3) break;
      checked += 1;
      const dcs = getComputedStyle(d);
      if (dcs.display !== "none" && dcs.visibility === "visible") return true;
    }
    return false;
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

  function block(el, backdropEl, isDialogWall) {
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
    if (isDialogWall) sweepDetachedDims(targets);
    unlockScroll();
    state.reassertUntil = now() + C.REASSERT_WINDOW_MS;

    if (!silent) {
      state.events += 1;
      try { api.runtime.sendMessage({ type: "nagless:blocked", count: 1 }); } catch { /* bg asleep/unavailable */ }
      showChip();
    }
  }

  function sweepDetachedDims(eventTargets) {
    // Some walls (Instagram desktop) keep their dimming layers as separate
    // fixed divs elsewhere in the DOM. When a dialog-bearing wall is blocked,
    // hide recently-appeared full-viewport dim layers so the page is usable.
    pruneRecent();
    for (const { el } of state.recent) {
      if (!el.isConnected || state.hidden.has(el) || eventTargets.includes(el)) continue;
      const cs = getComputedStyle(el);
      if (cs.position !== "fixed" || cs.display === "none") continue;
      const r = el.getBoundingClientRect();
      if (r.width < window.innerWidth * C.WALL_MIN_DIM_FRACTION ||
          r.height < window.innerHeight * C.WALL_MIN_DIM_FRACTION) continue;
      if (el.children.length > 2 || (el.textContent || "").trim().length > 40) continue;
      if (cs.backdropFilter === "none" && backgroundAlpha(cs.backgroundColor) <= 0.05) continue;
      hideEl(el);
      eventTargets.push(el);
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
