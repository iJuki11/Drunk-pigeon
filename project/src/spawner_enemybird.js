import { EnemyBird } from "./enemy_bird.js";

/**
 * Configuration recipes for crow enemy variants. To add a new variant
 * (faster, smaller, drops bonus, fires back, etc.) add an entry here and
 * choose it via the spawn recipe picker. Each variant can later carry its
 * own score/health/audio callbacks without rewriting the manager.
 */
export const BIRD_RECIPES = Object.freeze({
  default: Object.freeze({
    scale: 0.19,         // viewBox 640 wide → ~122 px on screen, matches airplane's visual footprint
    minSpeed: 120,        // px/s — slowest pass
    maxSpeed: 280,        // px/s — fastest pass
    spawnMargin: 120,     // px past the spawning edge
    scorePenalty: 0,
    damage: 1,
  }),
});

/**
 * Spawns crow birds that fly right-to-left and despawn off-screen.
 *
 * Mirrors the AirplaneManager pattern: a single active enemy at a time,
 * gated by `this.instances.length === 0`, with a global timer driving the
 * next spawn. Easy to extend later (projectiles, waves) by adding fields
 * to the recipe and reading them inside `spawnOne` / the active-instance
 * branch.
 *
 * Parts are injected once `AssetLoader.loadSvgParts()` resolves; until
 * then `spawnOne` is skipped so we never create a bird whose parts are
 * still null.
 */
export class BirdManager {
  constructor({
    audio,
    player,
    assets,
    recipes = BIRD_RECIPES,
    minInterval = 10,
    maxInterval = 15,
    spawnMarginTop = 80,
    spawnMarginBottom = 80,
    onPlayerHit,
    partIds = ["farWing", "nearWing", "tail", "feet", "body", "head"],
    svgSrc = "./assets/images/enemy_bird.svg",
  } = {}) {
    this.audio = audio;
    this.player = player;
    this.assets = assets;
    this.recipes = recipes;
    this.minInterval = minInterval;
    this.maxInterval = maxInterval;
    this.spawnMarginTop = spawnMarginTop;
    this.spawnMarginBottom = spawnMarginBottom;
    this.onPlayerHit =
      typeof onPlayerHit === "function" ? onPlayerHit : null;
    this.svgSrc = svgSrc;
    this.partIds = partIds;

    this.instances = [];
    this.timer = 0;
    // Cached parts promise — first spawn waits for it, subsequent spawns
    // reuse the resolved object via this.partsCache.
    this.partsPromise = null;
    this.partsCache = null;
    this.scheduleNext();
  }

  reset() {
    this.instances = [];
    this.timer = 0;
    this.scheduleNext();
    // Stop the bird SFX in case an instance was active when the game
    // restarted; without this the sound would keep looping.
    this.audio?.stopBird?.();
  }

  scheduleNext() {
    const span = Math.max(0, this.maxInterval - this.minInterval);
    this.nextSpawn = this.minInterval + Math.random() * span;
  }

  pickRecipe() {
    const keys = Object.keys(this.recipes);
    const key = keys[Math.floor(Math.random() * keys.length)];
    return { key, config: this.recipes[key] };
  }

  ensureParts() {
    if (this.partsCache) return Promise.resolve(this.partsCache);
    if (!this.assets?.loadSvgParts) return Promise.resolve(null);
    if (!this.partsPromise) {
      this.partsPromise = this.assets
        .loadSvgParts(this.svgSrc, this.partIds)
        .then((parts) => {
          this.partsCache = parts;
          return parts;
        })
        .catch((err) => {
          // Don't poison the cache — allow a later spawn attempt to retry
          // the fetch (matches the airplane head-load retry pattern).
          this.partsPromise = null;
          console.error("Failed to load enemy bird SVG parts:", err);
          return null;
        });
    }
    return this.partsPromise;
  }

  spawnOne(width, height) {
    const parts = this.partsCache;
    if (!parts) {
      // Parts still loading — defer this spawn by one frame's worth of
      // timer work so we retry next update() once the fetch resolves.
      return false;
    }

    const { key, config } = this.pickRecipe();
    const usableHeight = Math.max(
      1,
      height - this.spawnMarginTop - this.spawnMarginBottom,
    );
    const y = this.spawnMarginTop + Math.random() * usableHeight;
    // Pick a random speed per spawn between minSpeed and maxSpeed — keeps
    // each pass unpredictable so the player can't time dodges by rhythm.
    const speed = config.minSpeed + Math.random() * (config.maxSpeed - config.minSpeed);
    // Fly right-to-left: start past the right edge, move in -x. direction:
    // -1 flips the sprite horizontally so the bird visually faces the way
    // it's moving (head points left when flying left).
    const bird = new EnemyBird(width + config.spawnMargin, y, {
      scale: config.scale,
      direction: -1,
      velocityX: -speed,
    });
    bird.setParts(parts);
    // Kick off the one-second wing-flap burst so the bird visibly reacts
    // to entering the screen instead of drifting in flat-winged.
    bird.flap();

    this.instances.push({
      bird,
      recipeKey: key,
      config,
      speed,
      // Short grace period so the bird doesn't immediately re-collide with
      // the player on the same frame it spawns. Tunable per recipe later.
      damageCooldown: 0.4,
    });
    // Kick off the looping crow caw — volume is updated every frame in
    // update() via a bell curve, same shape as startAirplane. The caw
    // rises as the bird approaches the screen centre and falls as it
    // leaves.
    this.audio?.startBird?.("./assets/sounds/crow.mp3");
    // eslint-disable-next-line no-console
    console.log("[bird] spawned", { x: bird.x, y, recipe: key, speed: speed.toFixed(0) });
    return true;
  }

  update(deltaTime, width, height, player) {
    if (!Number.isFinite(deltaTime) || deltaTime <= 0) return;

    this.timer += deltaTime;

    if (this.instances.length === 0) {
      if (this.timer >= this.nextSpawn) {
        this.timer = 0;
        this.scheduleNext();
        // Kick off parts load lazily — first spawn will wait for them.
        this.ensureParts();
        this.spawnOne(width, height);
      }
      return;
    }

    const entry = this.instances[0];
    entry.bird.update(deltaTime);
    if (entry.damageCooldown > 0) {
      entry.damageCooldown = Math.max(0, entry.damageCooldown - deltaTime);
    }

    // Update bird SFX volume based on how close the bird is to the screen
    // centre. Call before despawn check so the fade-out begins as soon as
    // the bird nears the left edge. Same bell curve as the airplane.
    this.audio?.updateBirdSound?.(entry.bird.x, player?.x ?? 0, width);

    // Despawn once fully off the left edge.
    if (entry.bird.x < -200) {
      this.instances.shift();
      this.audio?.stopBird?.();
      return;
    }

    // Collision: AABB overlap with the player hitbox. The damage gate
    // lives inside Player.takeDamage() — it checks the invincibility
    // window and is a no-op while invincible. We additionally skip the
    // collision branch here so we don't even spend the AABB test during
    // the post-hit grace period and don't log "hit player" twice in a
    // row.
    const playerBounds = player?.getBounds?.();
    const playerInvincible =
      this.player?.isInvincible?.(performance.now() / 1000) === true;
    if (playerBounds && entry.damageCooldown === 0 && !playerInvincible) {
      const e = entry.bird.getBounds();
      const overlaps = !(
        e.right < playerBounds.left ||
        e.left > playerBounds.right ||
        e.bottom < playerBounds.top ||
        e.top > playerBounds.bottom
      );
      if (overlaps) {
        this.player?.takeDamage?.(entry.config.damage ?? 1);
        // Damage has been applied; start cooldown so a single collision
        // doesn't drain the whole healthbar in one pass.
        entry.damageCooldown = 0.6;
        // Fire the gameplay-side callback: visual effect, sound, and
        // the 2-second player invincibility window live there.
        this.onPlayerHit?.(entry.bird.x, entry.bird.y, entry.config);
        // eslint-disable-next-line no-console
        console.log("[bird] hit player, damage=", entry.config.damage ?? 1);
      }
    }
  }

  draw(ctx) {
    for (const entry of this.instances) entry.bird.draw(ctx);
  }

  activeItems() {
    return this.instances.length;
  }
}

export default BirdManager;