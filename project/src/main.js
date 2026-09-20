import { Game } from "./game.js";
import { InputController } from "./input.js";
import { GameUI } from "./ui.js";

const canvas = document.querySelector("#game-canvas");
const input = new InputController(canvas);
const ui = new GameUI();

// Loading screen lifecycle:
//   1. Show the loading overlay immediately so the user sees the brand-mark
//      the moment our JS runs (the HTML has no `hidden` attribute so the
//      overlay is visible even before this file executes).
//   2. Construct the Game with a progress callback wired to the UI.
//   3. Block input — flap/pause shouldn't be reactive while the world
//      hasn't rendered yet.
//   4. Await game.whenReady() — resolves when parallax + bird SVG are both
//      loaded, OR when parallax definitively failed (timeout/throw).
//   5. If the load finished in < 300 ms (warm cache) skip the fade-out and
//      just reveal the start screen. Otherwise fade the overlay out first.
//   6. If parallax failed, surface the "Učitavam offline scenu" toast so
//      the user knows why the city doesn't look quite right.
const LOADING_CACHE_SKIP_MS = 300;
const loadingStart = performance.now();

ui.showLoading();
input.setEnabled(false);

const game = new Game(canvas, input, ui, {
  onProgress: (loaded, total) => ui.updateProgress(loaded, total),
});

(async () => {
  try {
    await game.whenReady();
  } catch (error) {
    // whenReady() doesn't throw in practice — parallax failures are mapped
    // to a resolve via parallaxLoadFailed. But if something unexpected
    // happens (e.g. an asset exception bubbles through) we still want to
    // make sure the loading screen goes away.
    console.error("[main] whenReady rejected unexpectedly:", error);
  }

  const elapsed = performance.now() - loadingStart;
  if (elapsed > LOADING_CACHE_SKIP_MS) {
    // Long load: fade out smoothly so the brand-mark doesn't snap to the
    // start screen. Short load (< 300 ms = warm cache): skip the fade so
    // the user sees the start screen immediately with no flicker.
    await ui.hideLoading();
  }

  ui.showStart();
  input.setEnabled(true);

  if (game.didParallaxFail()) {
    // Only show the toast if parallax actually failed — happy path stays
    // silent. 5 s is enough for the user to read it before it fades.
    ui.showOfflineToast("Učitavam offline scenu");
  }
})();

ui.bindActions(
  () => game.start(),
  () => game.start(),
);