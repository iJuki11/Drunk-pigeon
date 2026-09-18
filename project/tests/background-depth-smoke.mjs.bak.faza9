import assert from "node:assert/strict";
import fs from "node:fs";

const gameSource = fs.readFileSync(new URL("../src/game.js", import.meta.url), "utf8");
const backgroundSource = fs.readFileSync(new URL("../src/parallax-background.js", import.meta.url), "utf8");

// game.js must drive the parallax via the editor's ParallaxRuntime (single
// renderer contract shared with the editor), not a hand-rolled renderer.
assert.match(gameSource, /globalThis\.ParallaxRuntime\.render\(/);
assert.match(gameSource, /from "\.\/parallax-background\.js"/);
assert.match(gameSource, /ZOOM_BACKGROUND/);
assert.match(gameSource, /SKIP_LAYER_IDS/);
// Dead config from the previous architecture must be gone.
assert.doesNotMatch(gameSource, /BACKGROUND_LOCAL_OFFSETS/);
assert.doesNotMatch(gameSource, /BACKGROUND_DEPTH_OVERRIDES/);
assert.doesNotMatch(gameSource, /localBreath/);
assert.doesNotMatch(gameSource, /new ParallaxBackground\(\)/);
// The game no longer overrides per-layer parallax — the JSON's parallax field
// is the single source of truth, shared with the editor.
assert.doesNotMatch(gameSource, /BACKGROUND_DEPTHS/);
// Pre-built scene cache must exist so draw() doesn't allocate 17 objects per frame.
assert.match(gameSource, /parallaxSceneCache/);
assert.match(gameSource, /this\.parallaxSceneCache = sceneForRuntime/);
// Per-frame allocations are minimized: gradient + ground + snapshot are cached.
assert.match(gameSource, /cachedSkyGradient/);
assert.match(gameSource, /cachedGroundY/);
assert.match(gameSource, /uiSnapshot/);
// Progressive decode avoids the first-frame 34-image spike.
assert.match(gameSource, /SCENE_LAYER_PRIORITY/);
assert.match(gameSource, /CONCURRENCY/);
// Sun and clouds are dropped from the runtime scene because their loop-only
// export only paints them in part 1 of the PNG; the empty part 2 causes a
// visible blink. Tracked in docs/parallax-bug-sun-clouds.md.
assert.match(gameSource, /layer\.id !== "sun"/);
assert.match(gameSource, /layer\.id !== "clouds"/);
// The opacity tweak for sun/clouds is no longer needed since the layers
// are not rendered at all.
assert.doesNotMatch(gameSource, /layer\.id === "clouds" \? Math\.min/);
assert.doesNotMatch(gameSource, /layer\.id === "sun" \? Math\.min/);

const uiSource = fs.readFileSync(new URL("../src/ui.js", import.meta.url), "utf8");
// UI updates must short-circuit when values haven't changed so DOM writes
// don't churn every frame.
assert.match(uiSource, /lastScoreText/);
assert.match(uiSource, /lastHealth/);
assert.match(uiSource, /lastCoffeeBoost/);

// Configuration file must export the constants game.js reads.
assert.match(backgroundSource, /export const ZOOM_BACKGROUND/);
assert.match(backgroundSource, /export const SKIP_LAYER_IDS/);
assert.doesNotMatch(backgroundSource, /class ParallaxBackground/);
assert.doesNotMatch(backgroundSource, /BACKGROUND_PERIODS/);
assert.doesNotMatch(backgroundSource, /BACKGROUND_DEPTHS/);

console.log("background depth smoke: ok (game uses ParallaxRuntime, scene cached at load, JSON parallax respected)");
