import assert from "node:assert/strict";
import { AssetLoader } from "../src/assets.js";
import { SKIP_LAYER_IDS } from "../src/parallax-background.js";

const listeners = new Map();
const rafQueue = [];
globalThis.window = {
  devicePixelRatio: 1,
  location: { href: "http://localhost/" },
  setTimeout,
  __DEBUG: {},
  addEventListener(type, handler) { listeners.set(type, handler); },
};
globalThis.document = {
  addEventListener(type, handler) { listeners.set(`document:${type}`, handler); },
};
globalThis.requestAnimationFrame = (callback) => rafQueue.push(callback);
globalThis.fetch = async (url) => url.includes("bird_image.svg")
  ? { ok: false, status: 404 }
  : {
      ok: true,
      async json() { return { assets: [], scene: { canvas: { height: 720 }, groundY: 680, layers: [] } }; },
    };
const decodedImageSources = [];
globalThis.Image = class {
  async decode() { decodedImageSources.push(this.src); }
  set src(value) { this._src = value; }
  get src() { return this._src; }
};
globalThis.Audio = class {
  src = "";
  volume = 1;
  play() { return Promise.resolve(); }
  pause() {}
  addEventListener() {}
};

// Keep integration coverage independent of SVG parsing and unrelated prewarm
// assets while still exercising Game's real lifecycle and frame loop.
AssetLoader.prototype.loadSvgParts = async () => ({ body: {}, wing: {} });
AssetLoader.prototype.prewarmEntities = async () => {};

const { Game } = await import("../src/game.js");
const gradient = { addColorStop() {} };
const context = {
  setTransform() {},
  createLinearGradient() { return gradient; },
  createRadialGradient() { return gradient; },
};
const canvas = {
  width: 0,
  height: 0,
  getContext() { return context; },
  getBoundingClientRect() { return this.bounds; },
  bounds: { width: 1280, height: 720 },
};
let nextFlap = false;
const input = {
  enabled: false,
  setEnabled(value) { this.enabled = value; },
  consumePause() { return false; },
  consumeFlap() { const value = nextFlap; nextFlap = false; return value; },
};
const ui = {
  showStart() {}, showPlaying() {}, showPaused() {}, hidePaused() {}, update() {}, showGameOver() {},
};

const game = new Game(canvas, input, ui);
assert.equal(game.worldX, 0, "new game starts at worldX=0");
game.start();
assert.equal(game.worldX, 0, "start resets worldX");
assert.equal(game.distance, 0, "start resets distance");
assert.equal(game.speed, 170, "start resets speed");

// A tap is accepted on the first gameplay update, before any bird SVG parts
// are available. Physics responds immediately and drawing safely waits/falls back.
game.player.parts = null;
game.player.velocityY = 0;
nextFlap = true;
game.update(1 / 60);
assert.ok(game.player.velocityY < 0, "an early tap applies the flap impulse");

for (let i = 0; i < 30; i += 1) game.update(1 / 60);
const beforePause = game.worldX;
assert.ok(beforePause > 0, "playing advances worldX");
game.pause();
assert.equal(game.state, "paused");
for (let i = 0; i < 30; i += 1) game.update(1 / 60);
assert.equal(game.worldX, beforePause, "pause freezes worldX");
game.resume();
assert.equal(game.state, "playing");
game.update(1 / 60);
assert.ok(game.worldX > beforePause, "resume continues worldX");

const beforeResize = game.worldX;
canvas.bounds = { width: 900, height: 600 };
game.resize();
assert.equal(game.worldX, beforeResize, "resize preserves worldX");
assert.equal(game.width, 900);
assert.equal(game.height, 600);

game.end();
game.start();
assert.equal(game.worldX, 0, "replay resets worldX");
assert.equal(game.distance, 0, "replay resets distance");
assert.equal(game.speed, 170, "replay resets speed");

// Verify the game's real frame loop renders at most 60 times across 120 Hz
// callbacks while retaining the configured cap.
game.setFpsCap(60);
game.lastTime = 1000;
game.lastRenderedTime = 1000;
let updates = 0;
let draws = 0;
game.update = () => { updates += 1; };
game.draw = () => { draws += 1; };
game.state = "playing";
game.frame(1008.333);
game.frame(1016.667);
assert.equal(updates, 1, "120Hz callbacks produce one gameplay update per 60Hz interval");
assert.equal(draws, 1, "120Hz callbacks produce one draw per 60Hz interval");
assert.ok(rafQueue.length >= 2, "skipped and rendered ticks both keep the animation loop alive");

const warnings = [];
const originalWarn = console.warn;
window.__DEBUG.isFrameTiming = true;
game.frameTimingWarningIssued = false;
console.warn = (message) => warnings.push(message);
for (let i = 0; i < 120; i += 1) game.recordFrameTime(i % 2 ? 5 : 30);
console.warn = originalWarn;
assert.ok(game.frameTiming.stdDev > 8, "unstable frame times exceed the 8ms limit");
assert.equal(game.frameTiming.withinBudget, false, "unstable frame times fail the frame budget");
assert.equal(warnings.length, 1, "unstable frame times produce one warning");

game.frameTimes = [];
for (let i = 0; i < 120; i += 1) game.recordFrameTime(16.667);
assert.ok(game.frameTiming.average < 16.7, "60 FPS average is below 16.7ms");
assert.ok(game.frameTiming.stdDev < 8, "steady 60 FPS stdDev is below 8ms");
assert.equal(game.frameTiming.withinBudget, true, "steady 60 FPS meets the frame budget");

game.frameTimes = [];
for (let i = 0; i < 120; i += 1) game.recordFrameTime(20);
assert.ok(game.frameTiming.average >= 16.7, "slow frames exceed the average frame limit");
assert.equal(game.frameTiming.withinBudget, false, "slow frames fail the frame budget");

// A failed player SVG still reaches the ready state and renders a procedural
// bird, so asset failure cannot leave the player invisible.
AssetLoader.prototype.loadSvgParts = async () => { throw new Error("SVG unavailable"); };
const originalError = console.error;
console.error = () => {};
const failedBirdGame = new Game(canvas, input, ui);
await Promise.resolve();
await Promise.resolve();
console.error = originalError;
assert.equal(failedBirdGame.didBirdFail(), true, "missing bird SVG is recorded");
assert.equal(failedBirdGame.player.shouldDraw(0), true, "missing SVG does not suppress player drawing");
let ellipseCount = 0;
const fallbackContext = new Proxy({}, {
  get(target, property) {
    if (property === "ellipse") return () => { ellipseCount += 1; };
    if (!(property in target)) target[property] = () => {};
    return target[property];
  },
  set(target, property, value) { target[property] = value; return true; },
});
failedBirdGame.player.draw(fallbackContext);
assert.ok(ellipseCount > 0, "missing bird SVG draws the procedural fallback");

// The background loader decodes only assets referenced by retained runtime
// layers; editor-only layers and unused asset records are skipped.
const skippedLayerId = [...SKIP_LAYER_IDS][0];
const runtimeLayers = [
  { id: "road", objects: [{ assetId: "road-asset" }] },
  { id: "sky", objects: [{ assetId: "sky-asset" }] },
  { id: "sun", objects: [{ assetId: "sun-asset" }] },
  { id: "clouds", objects: [{ assetId: "clouds-asset" }] },
  { id: skippedLayerId, objects: [{ assetId: "duplicate-asset" }] },
];
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => ({
  ok: true,
  async json() {
    return {
      assets: ["road-asset", "sky-asset", "sun-asset", "clouds-asset", "duplicate-asset", "unused-asset"]
        .map((id) => ({ id, data: id })),
      scene: { canvas: { height: 720 }, groundY: 680, layers: runtimeLayers },
    };
  },
});
decodedImageSources.length = 0;
await game._loadParallaxBackgroundImpl();
globalThis.fetch = originalFetch;
assert.deepEqual(decodedImageSources, ["road-asset"], "only retained layer assets are decoded");
assert.deepEqual(game.parallaxSceneCache.layers.map((layer) => layer.id), ["road"]);

// Let a real decoder finish only after the timeout. Its late image must not
// repopulate the image map or replace the procedural fallback scene.
const originalSetTimeout = globalThis.setTimeout;
let timeoutCallback;
let resolveLateDecode;
const originalImage = globalThis.Image;
const fetchBeforeTimeout = globalThis.fetch;
globalThis.setTimeout = (callback) => { timeoutCallback = callback; return 123; };
globalThis.Image = class {
  set src(value) { this._src = value; }
  decode() { return new Promise((resolve) => { resolveLateDecode = resolve; }); }
};
globalThis.fetch = async () => ({
  ok: true,
  async json() {
    return {
      assets: [{ id: "late-road", data: "late-image" }],
      scene: { canvas: { height: 720 }, groundY: 680, layers: [{ id: "road", objects: [{ assetId: "late-road" }] }] },
    };
  },
});
const timeoutWork = game.loadParallaxBackground();
await Promise.resolve();
await Promise.resolve();
assert.equal(typeof resolveLateDecode, "function", "test reaches an in-flight image decode");
timeoutCallback();
await assert.rejects(timeoutWork, /exceeded 5000 ms timeout/);
resolveLateDecode();
await Promise.resolve();
await Promise.resolve();
globalThis.setTimeout = originalSetTimeout;
globalThis.Image = originalImage;
globalThis.fetch = fetchBeforeTimeout;
assert.equal(game.parallaxProject, null, "timeout leaves the scene on the fallback");
assert.equal(game.parallaxSceneCache, null, "late decode cannot replace the fallback scene");
assert.equal(game.parallaxImages.size, 0, "late decode cannot add an image after cancellation");
console.log("game integration smoke: ok (lifecycle, early tap, 60 FPS cap, frame timing)");
