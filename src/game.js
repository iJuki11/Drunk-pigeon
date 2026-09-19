import { Player } from "./player.js";
import { CollectibleManager } from "./collectibles.js";
import { AssetLoader } from "./assets.js";
import { AudioBus } from "./audio.js";
import { PrsanManager, PadobranManager } from "./enemies.js";
import { CollisionEffects, COLLISION_EFFECT_DURATION } from "./collision_effects.js";
import { SKIP_LAYER_IDS, ZOOM_BACKGROUND } from "./parallax-background.js";

const CITY_WORLD_LENGTH = 4500;
const FRAME_TIMING_SAMPLE_SIZE = 120;
const FRAME_TIMING_MAX_AVERAGE = 16.7;
const FRAME_TIMING_WARNING_STD_DEV = 8;

const STATE = Object.freeze({
  START: "start",
  PLAYING: "playing",
  PAUSED: "paused",
  GAME_OVER: "game-over",
});

export class Game {
  constructor(canvas, input, ui) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.input = input;
    this.ui = ui;
    this.state = STATE.START;
    this.width = 0;
    this.height = 0;
    this.pixelRatio = 1;
    this.distance = 0;
    this.beers = 0;
    this.score = 0;
    this.speed = 170;
    this.worldX = 0;
    this.lastTime = 0;
    this.pauseTimestamp = 0;
    this.frameTimes = [];
    this.frameTiming = { average: 0, stdDev: 0, samples: 0, withinBudget: true };
    this.frameTimingWarningIssued = false;
    this.popups = [];
    this.cachedGroundY = 0;
    this.cachedSkyGradient = null;
    this.cachedSkyKey = "";
    this.coffees = 0;
    // Reused every frame so we don't allocate a snapshot object per update.
    this.uiSnapshot = {
      score: 0,
      beers: 0,
      coffees: 0,
      health: 0,
    };
    this.collectibles = new CollectibleManager();
    this.assets = new AssetLoader();
    this.assets.preload([]);
    // Bird SVG parts (body, wing, hat, leftLeg, rightLeg) are loaded once
    // and handed to Player. Player.draw() skips frames until parts arrive.
    this.player = new Player(90, 300, null);
    this.assets
      .loadSvgParts("./assets/images/bird/bird_image.svg", [
        "body",
        "wing",
        "hat",
        "leftLeg",
        "rightLeg",
      ])
      .then((parts) => {
        this.player.parts = parts;
      })
      .catch((err) => {
        // Bird won't render until this resolves. Log once so the failure
        // doesn't get swallowed silently.
        console.error("Failed to load bird SVG parts:", err);
      });
    // Player owns its own HP and invincibility window. takeDamage() on
    // Player already checks isInvincible() internally — no external gate
    // needed. PrsanManager and any future damage source just calls
    // player.takeDamage(amount).
    this.collisionEffects = new CollisionEffects();
    this.audio = new AudioBus();
    this.prsanManager = new PrsanManager({
      audio: this.audio,
      player: this.player,
      // Called the moment a prsan hit is accepted. Triggers the visual
      // burst, the hit sound, and arms the 2-second invincibility window.
      onPlayerHit: (x, y, config) => {
        const now = performance.now() / 1000;
        // Anchor the collision burst on the player's beak (a touch to the
        // right of centre) so the effect reads as "right where the plane
        // hit you" rather than somewhere on the airframe.
        const impactX = this.player.x + 22;
        const impactY = this.player.y - 2;
        this.collisionEffects.trigger(impactX, impactY, {
          // Scale up so the burst almost swallows the bird — sells the hit.
          scale: (config?.scale ?? 0.8) * 2.2,
          damage: config?.damage ?? 1,
        });
        this.audio.playHit();
        // Open the invincibility window now but defer the actual blink
        // until the very tail of the collision burst, so the player keeps
        // solid for the dramatic hit moment and starts blinking soon
        // after. Tunable here — lower = earlier blink, higher = later.
        this.player.grantInvincibility(now, 2, 0.15);
        // Refresh HUD so the lost heart shows up immediately. takeDamage
        // already mutated player.hp; snapshot() will pick up the new value.
        this.ui.update(this.snapshot());
      },
    });
    this.padobranManager = new PadobranManager({ minInterval: 5, maxInterval: 15 });

    this.parallaxProject = null;
    this.parallaxImages = new Map();
    this.parallaxSceneCache = null;
    // Fire-and-forget: loadParallaxBackground kicks off the JSON+PNG decode
    // pipeline and updates this.parallaxProject once images are ready. The
    // first few frames still use the procedural fallback, so there's no
    // startup hitch on the main thread.
    this.loadParallaxBackground();

    this.frame = this.frame.bind(this);
    this.resize = this.resize.bind(this);
    window.addEventListener("resize", this.resize);
    document.addEventListener("visibilitychange", () => {
      this.lastTime = performance.now();
    });

    this.resize();
    this.ui.showStart();
    // DEBUG ONLY: expose game for console inspection. Safe to leave in —
    // it does not affect gameplay and the only side effect is a single
    // property on window.
    if (typeof window !== "undefined") window.__game = this;
    requestAnimationFrame(this.frame);
  }

  resize() {
    const bounds = this.canvas.getBoundingClientRect();
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.max(1, bounds.width);
    this.height = Math.max(1, bounds.height);
    this.canvas.width = Math.round(this.width * this.pixelRatio);
    this.canvas.height = Math.round(this.height * this.pixelRatio);
    this.context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);

    // Recompute cached ground + sky gradient when viewport changes.
    this.cachedGroundY = this.computeGroundY();
    this.cachedSkyKey = `${this.width}x${this.height}`;
    this.cachedSkyGradient = this.context.createLinearGradient(0, 0, 0, this.height);
    this.cachedSkyGradient.addColorStop(0, "#c7cbca");
    this.cachedSkyGradient.addColorStop(0.55, "#aeb4b5");
    this.cachedSkyGradient.addColorStop(1, "#858c8e");

    if (this.state === STATE.START || this.state === STATE.GAME_OVER) {
      this.player.x = this.width * 0.25;
      this.player.y = Math.min(this.height * 0.44, this.cachedGroundY - this.player.height);
    }
  }

  start() {
    this.beers = 0;
    this.coffees = 0;
    this.popups = [];
    this.collisionEffects.clear();
    this.collectibles.reset();
    this.prsanManager.reset();
    this.padobranManager.reset();
    // Reset in place rather than re-instantiating: managers (PrsanManager)
    // already hold a reference to `player` from the constructor, and
    // swapping `this.player` to a fresh instance would orphan that
    // reference. Player.reset() restores HP, invincibility, velocity.
    this.player.reset(this.width * 0.25, this.height * 0.45);
    this.player.flap();
    this.state = STATE.PLAYING;
    this.input.setEnabled(true);
    this.ui.update(this.snapshot());
    this.ui.showPlaying();
    // Kick off background music (loops until stopMusic is called).
    this.audio.playMusic("./assets/sounds/gogomuck.mp3", 0.05);
    this.lastTime = performance.now();
  }

  end() {
    if (this.state !== STATE.PLAYING) return;
    this.state = STATE.GAME_OVER;
    this.input.setEnabled(false);
    this.audio.playGameOver();
    this.audio.stopMusic();
    this.audio.stopAirplane();
    this.ui.showGameOver(this.snapshot());
  }

  pause() {
    if (this.state !== STATE.PLAYING) return;
    this.state = STATE.PAUSED;
    this.pauseTimestamp = performance.now();
    this.audio.stopMusic();
    this.audio.stopAirplane();
    this.ui.showPaused();
  }

  resume() {
    if (this.state !== STATE.PAUSED) return;
    this.state = STATE.PLAYING;
    this.lastTime = performance.now();
    this.audio.playMusic("./assets/sounds/gogomuck.mp3", 0.05);
    this.ui.hidePaused();
  }

  togglePause() {
    if (this.state === STATE.PLAYING) {
      this.pause();
    } else if (this.state === STATE.PAUSED) {
      this.resume();
    }
  }

  snapshot() {
    // Mutate the cached object in place — the UI only reads fields, and
    // allocating a fresh one per frame is wasted GC pressure at 60 fps.
    const s = this.uiSnapshot;
    s.score = this.computeScore();
    s.beers = this.beers;
    s.coffees = this.coffees;
    s.health = this.player.hp;
    return s;
  }

  computeScore() {
    // Single source of truth for "what is the score". If the formula
    // ever grows (distance multiplier, combo bonus, …) there is now
    // exactly one place to change it.
    return this.beers + this.coffees;
  }

  frame(timestamp) {
    if (!this.lastTime) this.lastTime = timestamp;
    const frameTime = timestamp - this.lastTime;
    if (frameTime > 0) this.recordFrameTime(frameTime);
    // Cap deltaTime at 100 ms so a single frame skip (resize, GC, tab refocus)
    // doesn't catapult the world forward — but allow more headroom than 0.034
    // so a normal 60 Hz frame (16.7 ms) and a slightly delayed frame (33 ms)
    // both feel smooth.
    const deltaTime = Math.min(frameTime / 1000, 0.1);
    this.lastTime = timestamp;

    this.update(deltaTime);
    this.draw();
    requestAnimationFrame(this.frame);
  }

  recordFrameTime(frameTime) {
    this.frameTimes.push(frameTime);
    if (this.frameTimes.length > FRAME_TIMING_SAMPLE_SIZE) this.frameTimes.shift();

    const average = this.frameTimes.reduce((sum, value) => sum + value, 0) / this.frameTimes.length;
    const variance = this.frameTimes.reduce((sum, value) => sum + (value - average) ** 2, 0) / this.frameTimes.length;
    const stdDev = Math.sqrt(variance);
    this.frameTiming = {
      average,
      stdDev,
      samples: this.frameTimes.length,
      withinBudget: average < FRAME_TIMING_MAX_AVERAGE && stdDev < FRAME_TIMING_WARNING_STD_DEV,
    };

    if (
      this.frameTiming.samples === FRAME_TIMING_SAMPLE_SIZE
      && !this.frameTiming.withinBudget
      && !this.frameTimingWarningIssued
    ) {
      console.warn(`[frame-timing] high frame-time deviation: ${this.frameTiming.stdDev.toFixed(1)}ms`);
      this.frameTimingWarningIssued = true;
    }
  }

  update(deltaTime) {
    if (this.input.consumePause()) this.togglePause();

    if (this.state !== STATE.PLAYING) {
      this.input.consumeFlap();
      return;
    }

    this.worldX += this.speed * deltaTime;

    if (this.input.consumeFlap()) { this.player.flap(); }

    this.player.update(deltaTime);
    // Speed still ramps with distance — distance is no longer shown in the
    // HUD but it still drives how fast the world scrolls.
    this.speed = Math.min(255, 170 + this.distance * 0.05);
    this.distance += this.speed * deltaTime * 0.055;

    const groundY = this.getGroundY();
    this.collectibles.update(deltaTime, this.speed, this.width, this.height, groundY);
    this.prsanManager.update(deltaTime, this.width, this.height, this.player);
    this.padobranManager.update(deltaTime, this.width, this.height);
    this.collisionEffects.update(deltaTime);
    const collectedItems = this.collectibles.collect(this.player.getBounds());

    for (const item of collectedItems) {
      if (item.type === "coffee") {
        this.audio.playCoffee();
        this.coffees += 1;
        this.popups.push({ x: item.x, y: item.y, age: 0, value: "+1" });
      } else {
        this.beers += 1;
        this.audio.playBeer();
        this.popups.push({ x: item.x, y: item.y, age: 0, value: "+1" });
      }
    }
    // Refresh HUD only when something visible to it changed (collect
    // event here; hit event in onPlayerHit; start/end reset it).
    // The DOM cache in ui.js is a backstop — these calls are cheap.
    if (collectedItems.length > 0) this.ui.update(this.snapshot());

    for (const popup of this.popups) {
      popup.age += deltaTime;
      popup.y -= 34 * deltaTime;
    }
    // Swap-and-pop to avoid allocating a new array every frame.
    for (let i = this.popups.length - 1; i >= 0; i -= 1) {
      if (this.popups[i].age >= 0.85) this.popups.splice(i, 1);
    }

    const bounds = this.player.getBounds();
    if (bounds.top <= 4 || bounds.bottom >= groundY || this.player.isDead()) this.end();
  }

  getGroundY() {
    return this.cachedGroundY;
  }

  computeGroundY() {
    // Where the scene's authored ground line lands on screen. The scene is
    // drawn at native scale anchored to the top, so scene.groundY=595 in
    // scene pixels lands here in viewport pixels. The player must stay above
    // this line.
    if (!this.parallaxProject) {
      return this.height - Math.max(46, this.height * 0.065);
    }
    const scene = this.parallaxProject.scene;
    const zoom = Number.isFinite(ZOOM_BACKGROUND) && ZOOM_BACKGROUND > 0 ? ZOOM_BACKGROUND : 1;
    const scale = (this.height / scene.canvas.height) * zoom;
    return Math.round(scene.groundY * scale);
  }

  async loadParallaxBackground() {
    try {
      const response = await fetch("./assets/backgrounds/background.parallax.json");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const project = await response.json();
      // Decode foreground assets first so the playable scene is visible
      // within the first frame or two; far/mid layers can land a moment
      // later. The sky / sun / clouds layers are not used by the game
      // (see docs/parallax-bug-sun-clouds.md) so we deprioritise them.
      const SCENE_LAYER_PRIORITY = [
        "road", "cafe", "house", "hedge", "lamps", "trees",
        "06c-houses-front", "06b-houses-middle", "06a-houses-back",
        "mid", "far",
      ];
      const layerByAssetId = new Map();
      for (const layer of project.scene.layers) {
        for (const object of layer.objects || []) {
          if (!layerByAssetId.has(object.assetId)) {
            layerByAssetId.set(object.assetId, layer.id);
          }
        }
      }
      const order = (asset) => {
        const layerId = layerByAssetId.get(asset.id);
        const idx = SCENE_LAYER_PRIORITY.indexOf(layerId);
        return idx === -1 ? SCENE_LAYER_PRIORITY.length : idx;
      };
      const sortedAssets = [...project.assets].sort((a, b) => order(a) - order(b));
      // Decode in chunks of 4 at a time so we don't spike 34 simultaneous
      // decode jobs — that would jank the first paint hard on phones.
      const CONCURRENCY = 4;
      for (let i = 0; i < sortedAssets.length; i += CONCURRENCY) {
        const batch = sortedAssets.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map(async (asset) => {
          if (this.parallaxImages.has(asset.id)) return;
          const image = new Image();
          image.src = asset.data;
          await image.decode();
          this.parallaxImages.set(asset.id, image);
        }));
      }
      this.parallaxProject = project;
      // Pre-build the scene we hand to ParallaxRuntime every frame. Drops:
      //   - sky layer (game paints its own viewport gradient)
      //   - sun and clouds (loop-only export puts them only in part 1 of the
      //     PNG, so when the parallax phase crosses the 4096→4500 boundary the
      //     viewport shows an empty sky strip — see docs/parallax-bug-sun-clouds.md)
      //   - any SKIP_LAYER_IDS duplicates
      // The remaining layers (far, mid, houses, road, ...) all wrap correctly.
      const scene = project.scene;
      const sceneForRuntime = {
        ...scene,
        layers: scene.layers
          .filter((layer) =>
            layer.id !== "sky" &&
            layer.id !== "sun" &&
            layer.id !== "clouds" &&
            !SKIP_LAYER_IDS.has(layer.id)
          )
          .map((layer) => {
            return { ...layer };
          }),
      };
      this.parallaxSceneCache = sceneForRuntime;
      // The scene changed — refresh ground cache so the player doesn't spawn
      // or rest on a fallback ground line.
      this.cachedGroundY = this.computeGroundY();
    } catch (error) {
      console.warn("[parallax] failed to load:", error);
    }
  }

  draw() {
    const context = this.context;
    context.clearRect(0, 0, this.width, this.height);

    if (this.parallaxSceneCache && globalThis.ParallaxRuntime) {
      const scene = this.parallaxProject.scene;
      const groundY = this.getGroundY();

      const zoom =
        Number.isFinite(ZOOM_BACKGROUND) && ZOOM_BACKGROUND > 0
          ? ZOOM_BACKGROUND
          : 1;

      const baseScale = this.height / scene.canvas.height;
      const scale = baseScale * zoom;

      context.save();
      context.beginPath();
      context.rect(0, 0, this.width, this.height);
      context.clip();

      // Nebo popunjava prostor koji se otkrije odzumiranjem.
      // Gradient is built once in resize() and reused every frame.
      context.fillStyle = this.cachedSkyGradient;
      context.fillRect(0, 0, this.width, this.height);

      // Podloga ispod razine tla.
      context.fillStyle = "#2f3436";
      context.fillRect(
        0,
        groundY,
        this.width,
        this.height - groundY
      );

      // Draw the full 724px scene at native-ish scale and pin its top to the
      // viewport's top. The road strip is whatever space remains below the
      // scene — typically a few pixels because 724 ≈ viewport.height.
      const scenePixelHeight = scene.canvas.height * scale;
      // Clip to the scene so any tiny overshoot at the bottom doesn't bleed
      // past the road strip.
      context.save();
      context.beginPath();
      context.rect(0, 0, this.width, this.height);
      context.clip();

      globalThis.ParallaxRuntime.render(
        context,
        this.parallaxSceneCache,
        this.parallaxImages,
        this.worldX,
        {
          width: this.width,
          height: scenePixelHeight,
          viewportWidth: this.width / scale,
          clear: false,
        }
      );

      context.restore();

      context.restore();
    } else {
      // Procedural fallback while the editor export loads or if it fails.
      this.drawSky(context);
      this.drawClouds(context);
      this.drawSkyline(context, 0.16, this.height * 0.52, "#969c9e", 54, 105);
      this.drawSkyline(context, 0.34, this.height * 0.68, "#737a7c", 68, 150);
      this.drawSkyline(context, 0.62, this.height * 0.79, "#50575a", 84, 210);
      this.drawGround(context);
    }

    this.collectibles.draw(context);
    this.prsanManager.draw(context);
    this.padobranManager.draw(context);
    // Render the player only on flash-visible frames while invincible; the
    // collision effects overlay sits between the enemy and the player so
    // the burst reads on top of the plane and underneath the recoil.
    const drawNow = performance.now() / 1000;
    if (this.player.shouldDraw(drawNow)) {
      this.player.draw(context);
    }
    this.collisionEffects.draw(context);
    this.drawPopups(context);
    this.drawVignette(context);
  }

  drawSky(context) {
    context.fillStyle = this.cachedSkyGradient;
    context.fillRect(0, 0, this.width, this.height);

    context.fillStyle = "rgba(242, 240, 225, 0.38)";
    context.beginPath();
    context.arc(this.width * 0.78, this.height * 0.17, 42, 0, Math.PI * 2);
    context.fill();
  }

  drawClouds(context) {
    const offset = (this.worldX * 0.08) % (this.width + 230);
    for (let index = -1; index < 3; index += 1) {
      const x = index * 230 - offset + 70;
      const y = this.height * (0.18 + (index % 2) * 0.09);
      context.fillStyle = "rgba(235, 237, 233, 0.55)";
      context.beginPath();
      context.ellipse(x, y, 54, 17, 0, 0, Math.PI * 2);
      context.ellipse(x + 28, y - 8, 32, 18, 0, 0, Math.PI * 2);
      context.ellipse(x - 28, y - 5, 28, 15, 0, 0, Math.PI * 2);
      context.fill();
    }
  }

  drawSkyline(context, parallax, baseline, color, minWidth, maxHeight) {
    const gap = 7;
    const step = minWidth + gap;
    const offset = (this.worldX * parallax) % step;
    const startIndex = Math.floor((this.worldX * parallax) / step);
    context.fillStyle = color;

    for (let index = -2; index < Math.ceil(this.width / step) + 2; index += 1) {
      const worldIndex = startIndex + index;
      const noise = seededNoise(worldIndex * 7 + Math.round(parallax * 100));
      const width = minWidth * (0.72 + seededNoise(worldIndex * 11) * 0.58);
      const height = maxHeight * (0.42 + noise * 0.58);
      const x = index * step - offset;
      const y = baseline - height;
      context.fillRect(x, y, width, height);

      if (parallax > 0.3) {
        context.fillStyle = "rgba(210, 213, 210, 0.32)";
        const columns = Math.max(1, Math.floor(width / 19));
        for (let column = 0; column < columns; column += 1) {
          for (let row = 0; row < Math.floor(height / 28); row += 1) {
            if ((column + row + worldIndex) % 3 !== 0) {
              context.fillRect(x + 8 + column * 17, y + 11 + row * 25, 5, 8);
            }
          }
        }
        context.fillStyle = color;
      }

      if (parallax > 0.5 && worldIndex % 4 === 0) {
        context.fillRect(x + width * 0.55, y - 23, 3, 23);
        context.beginPath();
        context.arc(x + width * 0.55 + 1.5, y - 25, 4, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  drawGround(context) {
    const groundY = this.getGroundY();
    context.fillStyle = "#2f3436";
    context.fillRect(0, groundY, this.width, this.height - groundY);
    context.fillStyle = "#454b4d";
    context.fillRect(0, groundY, this.width, 8);

    const dashOffset = (this.worldX * 0.9) % 48;
    context.fillStyle = "rgba(255, 255, 255, 0.14)";
    for (let x = -dashOffset; x < this.width; x += 48) {
      context.fillRect(x, groundY + 20, 25, 3);
    }
  }

  drawPopups(context) {
    context.save();
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "900 20px Inter, system-ui, sans-serif";
    for (const popup of this.popups) {
      const progress = popup.age / 0.85;
      const scale = 0.72 + Math.sin(Math.min(1, progress * 2) * Math.PI * 0.5) * 0.35;
      context.globalAlpha = 1 - progress;
      context.save();
      context.translate(popup.x, popup.y);
      context.scale(scale, scale);
      context.fillStyle = "#fff4c6";
      context.strokeStyle = "rgba(91, 57, 5, 0.6)";
      context.lineWidth = 5;
      context.strokeText(popup.value, 0, 0);
      context.fillText(popup.value, 0, 0);
      context.restore();
    }
    context.restore();
  }

  drawVignette(context) {
    const gradient = context.createRadialGradient(
      this.width * 0.5,
      this.height * 0.42,
      this.width * 0.2,
      this.width * 0.5,
      this.height * 0.5,
      Math.max(this.width, this.height) * 0.72,
    );
    gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(1, "rgba(8, 11, 12, 0.16)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, this.width, this.height);
  }
}

function seededNoise(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}
