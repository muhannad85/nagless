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
    WALL_MIN_DIM_FRACTION: 0.9,
    SIGNAL_MIN_AREA_FRACTION: 0.08,
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
    const overlayPositioned =
      c.position === "fixed" || c.position === "sticky" ||
      // App-shell walls (Instagram desktop): when the page scrolls an inner
      // container, a positioned viewport-covering layer carrying a visible
      // dialog is an overlay without ever being position:fixed.
      (c.coversViewport && c.positioned && c.hasDialogSemantics);
    if (!overlayPositioned) return false;
    if (!c.visible || c.opacity <= CONFIG.MIN_OPACITY) return false;
    // Video players are content, not nags: an element carrying a <video> and
    // no text input is never blockable (learned from the YouTube sticky
    // player false positive). Signup modals with promo videos still carry
    // an input, so they fall through to normal scoring.
    if (c.hasVideo && !c.hasTextInput) return false;
    // A modest centered card still intercepts the whole page when it comes
    // with a backdrop, a scroll-lock, or dialog semantics — those earn a much
    // lower size floor. Raw size alone needs to be genuinely large.
    const bigEnough =
      c.viewportCoverage >= CONFIG.MIN_AREA_FRACTION ||
      (c.widthFraction >= CONFIG.SHEET_MIN_WIDTH_FRACTION &&
        c.heightFraction >= CONFIG.SHEET_MIN_HEIGHT_FRACTION) ||
      ((c.hasBackdrop || c.scrollLockNearby || c.hasDialogSemantics) &&
        c.viewportCoverage >= CONFIG.SIGNAL_MIN_AREA_FRACTION);
    if (!bigEnough) return false;
    // Elements already present when we injected are page furniture (app
    // shells, maps, editors). They must show intent to nag, not just shape.
    // The keyword must be on the element itself — a child's class (e.g. a
    // video player's "control-overlay" layer) is not intent to nag.
    if (c.preexisting && !(c.hasDialogSemantics || c.keywordHitSelf)) return false;
    return true;
  }

  function softScore(c) {
    let score = 0;
    if (c.scrollLockNearby) score += 2;
    if (c.hasDialogSemantics) score += 2;
    if (c.hasBackdrop) score += 2;
    if (c.hasTextInput || c.textInputFocused) score += 2;
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
