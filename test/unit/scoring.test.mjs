import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const S = createRequire(import.meta.url)("../../src/common/scoring.js");

const base = {
  uninvited: true, isOwnUi: false, alreadyProcessed: false, preexisting: false,
  position: "fixed", visible: true, opacity: 1,
  viewportCoverage: 0.5, widthFraction: 0.7, heightFraction: 0.7,
  zIndex: 2000, hasDialogSemantics: false, hasTextInput: false, textInputFocused: false, hasVideo: false, keywordHitSelf: false,
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

test("small centered card passes the size gate when a backdrop accompanies it", () => {
  const card = { ...base, viewportCoverage: 0.15, widthFraction: 0.38, heightFraction: 0.4, hasBackdrop: true };
  assert.equal(S.passesHardGates(card), true);
});

test("small centered card passes the size gate when a scroll-lock accompanies it", () => {
  const card = { ...base, viewportCoverage: 0.15, widthFraction: 0.38, heightFraction: 0.4, scrollLockNearby: true };
  assert.equal(S.passesHardGates(card), true);
});

test("small dialog-role card passes the size gate", () => {
  const card = { ...base, viewportCoverage: 0.15, widthFraction: 0.38, heightFraction: 0.4, hasDialogSemantics: true };
  assert.equal(S.passesHardGates(card), true);
});

test("signal-assisted gate still floors out tiny elements", () => {
  const toast = { ...base, viewportCoverage: 0.04, widthFraction: 0.3, heightFraction: 0.1, hasDialogSemantics: true, scrollLockNearby: true };
  assert.equal(S.passesHardGates(toast), false);
});

test("plain banner without dialog/backdrop/lock stays gated even above the floor", () => {
  const banner = { ...base, viewportCoverage: 0.17, widthFraction: 1, heightFraction: 0.17 };
  assert.equal(S.passesHardGates(banner), false);
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
  assert.equal(S.shouldBlock({ ...appShell, keywordHit: true, keywordHitSelf: true }), true);
  assert.equal(S.shouldBlock({ ...appShell, hasDialogSemantics: true }), true);
});

test("video players are immune: contains video, no text input", () => {
  const player = { ...base, hasVideo: true, scrollLockNearby: true, hasDialogSemantics: true, viewportCoverage: 0.9 };
  assert.equal(S.passesHardGates(player), false);
});

test("video immunity yields to a text input (video inside a signup modal)", () => {
  const promo = { ...base, hasVideo: true, hasTextInput: true, hasBackdrop: true };
  assert.equal(S.shouldBlock(promo), true);
});

test("preexisting gate needs the keyword on the element itself, not a child", () => {
  const furniture = { ...base, preexisting: true, keywordHit: true, keywordHitSelf: false, textInputFocused: true };
  assert.equal(S.passesHardGates(furniture), false);
  assert.equal(S.passesHardGates({ ...furniture, keywordHitSelf: true }), true);
});

test("preexisting full-screen wall with deep dialog semantics is blockable", () => {
  const wall = { ...base, preexisting: true, viewportCoverage: 1, widthFraction: 1, heightFraction: 1,
    hasDialogSemantics: true, zIndex: 20 };
  assert.equal(S.shouldBlock(wall), true); // dialog 2 + fullscreen 1 = 3
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
