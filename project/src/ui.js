const HEALTH_HEART_COUNT = 3;

export class GameUI {
  constructor() {
    this.startScreen = document.querySelector("#start-screen");
    this.gameOverScreen = document.querySelector("#game-over-screen");
    this.hud = document.querySelector("#hud");
    this.touchPrompt = document.querySelector("#touch-prompt");
    this.pauseOverlay = document.querySelector("#pause-overlay");

    // Loading screen — shown until parallax PNGs and the bird SVG have both
    // been fetched and decoded. Owned by main.js: it calls showLoading() before
    // constructing Game, then hideLoading() once Game.whenReady() resolves.
    this.loadingScreen = document.querySelector("#loading-screen");
    this.loadingProgressText = document.querySelector("#loading-progress-text");
    this.loadingBarFill = document.querySelector("#loading-bar-fill");
    // Cached so updateProgress doesn't churn textContent + bar style every
    // frame (main.js only calls updateProgress on batch boundaries anyway,
    // but the guard keeps it safe if someone wires it to a tighter loop).
    this.lastProgressText = "";

    this.beerValue = document.querySelector("#beer-value");
    this.coffeeValue = document.querySelector("#coffee-value");
    this.healthHearts = [...document.querySelectorAll(".health-heart")];
    this.finalScore = document.querySelector("#final-score");
    this.finalBeers = document.querySelector("#final-beers");
    this.playButton = document.querySelector("#play-button");

    // Cached DOM state — the UI is only written when a value actually
    // changes. Touching textContent or classList on every frame costs
    // real time on the main thread, especially with `toLocaleString`.
    this.lastBeerText = "";
    this.lastCoffeeText = "";
    this.lastHealth = -1;
  }

  bindActions(onPlay, onReplay) {
    this.playButton.addEventListener("click", onPlay);
    document.querySelector("#replay-button").addEventListener("click", onReplay);
  }

  showLoading() {
    // Loading screen is visible by default (no `hidden` attribute) so the
    // user sees the brand-mark the moment the HTML parses, before any JS
    // runs. Re-show it here too in case showStart/showGameOver hid it.
    if (this.loadingScreen) {
      this.loadingScreen.hidden = false;
      this.loadingScreen.classList.remove("is-leaving");
      this.loadingScreen.classList.remove("has-progress");
    }
    // Hide every other screen so nothing competes with the loading overlay
    // for the user's eye. We don't bother hiding the HUD — it already has
    // `hidden` set in HTML and only showPlaying() ever reveals it.
    this.startScreen.hidden = true;
    this.gameOverScreen.hidden = true;
    this.hidePaused();
    // Hide the start screen's "UČITAVANJE…" state too — the dedicated overlay
    // is a better signal than a disabled button.
    if (typeof this.setBackgroundLoading === "function") {
      this.setBackgroundLoading(false);
    }
  }

  updateProgress(loaded, total) {
    if (!this.loadingScreen) return;
    // Once we get the first progress signal we can reveal the determinate
    // widgets. Before that we show only the brand-mark + breathing logo.
    this.loadingScreen.classList.add("has-progress");
    const safeTotal = Math.max(1, total | 0);
    const safeLoaded = Math.max(0, Math.min(loaded | 0, safeTotal));
    const text = `${safeLoaded} / ${safeTotal} slika`;
    if (text !== this.lastProgressText) {
      this.loadingProgressText.textContent = text;
      this.lastProgressText = text;
    }
    const pct = Math.round((safeLoaded / safeTotal) * 100);
    // setProperty is cheaper than re-styling the inline style attribute;
    // it's a no-op when the value is unchanged.
    this.loadingBarFill.style.setProperty("width", `${pct}%`);
  }

  async hideLoading() {
    if (!this.loadingScreen) return;
    // Mark as leaving so the CSS opacity transition runs, then detach from
    // the layout after the transition. Without the timeout the user sees a
    // hard pop the instant we set hidden=true.
    if (this.loadingScreen.hidden) return;
    this.loadingScreen.classList.add("is-leaving");
    await new Promise((resolve) => setTimeout(resolve, 320));
    this.loadingScreen.hidden = true;
    this.loadingScreen.classList.remove("is-leaving");
    // Don't clear lastProgressText — keeping the final value cached means a
    // later accidental re-show reuses the last known percentage rather than
    // flashing "0 / 0 slika" for one frame.
  }

  showOfflineToast(message = "Učitavam offline scenu") {
    // Lightweight, non-blocking toast for the case where the parallax JSON
    // failed to load and we fell back to the procedural scene after 5 s.
    // A single instance is reused — no DOM thrash, no memory leak risk.
    let toast = document.querySelector("#offline-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "offline-toast";
      toast.className = "offline-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.querySelector(".game-shell")?.appendChild(toast);
    }
    toast.textContent = message;
    // Force a reflow before toggling the visible class so the
    // fade-in transition runs even if the toast was already in the DOM.
    toast.classList.remove("is-visible");
    void toast.offsetWidth;
    toast.classList.add("is-visible");
    clearTimeout(toast.__hideTimer);
    toast.__hideTimer = setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 5000);
  }

  showStart() {
    this.startScreen.hidden = false;
    this.gameOverScreen.hidden = true;
    this.hud.hidden = true;
    this.touchPrompt.hidden = true;
    this.hidePaused();
  }

  setBackgroundLoading(loading, failed = false) {
    this.playButton.disabled = loading || failed;
    if (failed) {
      this.playButton.querySelector("span").textContent = "POZADINA NIJE DOSTUPNA";
    } else if (loading) {
      this.playButton.querySelector("span").textContent = "UČITAVANJE…";
    } else {
      this.playButton.querySelector("span").textContent = "IGRAJ";
    }
    this.playButton.setAttribute("aria-busy", loading ? "true" : "false");
  }

  showPlaying() {
    this.startScreen.hidden = true;
    this.gameOverScreen.hidden = true;
    this.hud.hidden = false;
    this.touchPrompt.hidden = false;
    window.setTimeout(() => {
      this.touchPrompt.hidden = true;
    }, 2200);
  }

  showPaused() {
    this.pauseOverlay.hidden = false;
  }

  hidePaused() {
    this.pauseOverlay.hidden = true;
  }

  showGameOver({ score, beers, coffees }) {
    this.hidePaused();
    this.hud.hidden = true;
    this.touchPrompt.hidden = true;
    this.gameOverScreen.hidden = false;
    if (this.finalScore) this.finalScore.textContent = score.toLocaleString("hr-HR");
    if (this.finalBeers) this.finalBeers.textContent = beers.toString();
    const finalCoffees = document.querySelector("#final-coffees");
    if (finalCoffees) finalCoffees.textContent = (coffees ?? 0).toString();
    document.querySelector("#replay-button").focus({ preventScroll: true });
    // Reset cached values so the next update() repaints them.
    this.lastBeerText = "";
    this.lastCoffeeText = "";
    this.lastHealth = -1;
  }

  update({ beers, coffees = 0, health = HEALTH_HEART_COUNT }) {
    const beerText = beers.toString();
    if (beerText !== this.lastBeerText) {
      this.beerValue.textContent = beerText;
      this.lastBeerText = beerText;
    }
    const coffeeText = coffees.toString();
    if (coffeeText !== this.lastCoffeeText) {
      if (this.coffeeValue) this.coffeeValue.textContent = coffeeText;
      this.lastCoffeeText = coffeeText;
    }
    if (health !== this.lastHealth) {
      for (let index = 0; index < this.healthHearts.length; index += 1) {
        this.healthHearts[index].classList.toggle("lost", index >= health);
      }
      this.lastHealth = health;
    }
  }
}
