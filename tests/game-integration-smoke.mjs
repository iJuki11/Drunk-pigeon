import assert from "node:assert/strict";

const listeners = new Map();
const windowStub = {
  devicePixelRatio: 1,
  addEventListener(type, handler) { listeners.set(type, handler); },
  setTimeout,
};
globalThis.window = windowStub;
globalThis.document = {
  addEventListener(type, handler) { listeners.set(`document:${type}`, handler); },
};
globalThis.requestAnimationFrame = () => {};
globalThis.fetch = async () => ({
  ok: true,
  async json() {
    return { assets: [], scene: { canvas: { height: 720 }, groundY: 720, layers: [] } };
  },
});
globalThis.Image = class {
  async decode() {}
  set src(_value) {}
};

const { Game } = await import("../src/game.js");

const context = { setTransform() {} };
const canvas = {
  width: 0,
  height: 0,
  getContext() { return context; },
  getBoundingClientRect() { return this.bounds; },
  bounds: { width: 1280, height: 720 },
};
const input = {
  enabled: false,
  setEnabled(value) { this.enabled = value; },
  consumePause() { return false; },
  consumeFlap() { return false; },
};
const ui = {
  showStart() {}, showPlaying() {}, showPaused() {}, hidePaused() {}, update() {}, showGameOver() {},
};

const game = new Game(canvas, input, ui);
assert.equal(game.worldX, 0, "new game starts at worldX=0");
game.start();
assert.equal(game.worldX, 0, "start resets worldX");
assert.equal(game.distance, 0, "start resets distance");

// Advance a short controlled playing interval without allowing collision game-over.
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

const warnings = [];
const originalWarn = console.warn;
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
console.log("game integration smoke: ok (start, pause, resume, resize, replay, frame timing)");
