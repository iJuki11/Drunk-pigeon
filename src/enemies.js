import { EnemyPrsan } from "./enemy_prsan.js";
import { EnemyPrsanPadobran } from "./enemy_prsan_padobran.js";

/**
 * Configuration recipes for prsan enemy variants. To add a new variant
 * (faster, smaller, drops bonus, fires back, etc.) add an entry here and
 * choose it via the spawn recipe picker. Each variant can later carry its
 * own score/health/audio callbacks without rewriting the manager.
 */
export const PRSAN_RECIPES = Object.freeze({
  default: Object.freeze({
    scale: 0.8,
    minSpeed: 150,         // px/s — slowest pass (half of original 180)
    maxSpeed: 360,        // px/s — fastest pass (double of original 180)
    spawnMargin: 120,     // px past the spawning edge
    scorePenalty: 0,
    damage: 1,
  }),
});

export class ToniManager {
  constructor(assets, audio, health, onHit) { this.assets = assets; this.audio = audio; this.health = health; this.onHit = onHit; this.toni = null; this.arrows = []; this.timer = 0; this.nextSpawn = 10 + Math.random() * 10; }
  reset() { this.toni = null; this.arrows = []; this.timer = 0; this.nextSpawn = 10 + Math.random() * 10; }
  update(dt, width, height, player) {
    if (!this.toni) { this.timer += dt; if (this.timer >= this.nextSpawn) { this.timer = 0; this.toni = { x: width - 80, y: 60 + Math.random() * Math.max(1, height * .6 - 60), phase: "prepare", elapsed: 0, cycles: 0, maxCycles: 2 + (Math.random() < .5 ? 1 : 0), targetY: player.y }; } }
    const t = this.toni;
    if (t) { t.elapsed += dt; if (t.phase === "prepare") { const followSpeed = 360; const maxStep = followSpeed * dt; const delta = Math.max(-maxStep, Math.min(maxStep, player.y - t.y)); t.y += delta; if (t.elapsed >= 3) { t.phase = "shoot"; t.elapsed = 0; t.targetY = player.y; } } else if (t.phase === "shoot" && t.elapsed >= 4) { this.arrows.push({ x: t.x - 40, y: t.targetY }); this.audio.playShot(); t.cycles += 1; t.elapsed = 0; if (t.cycles >= t.maxCycles) t.phase = "exit"; } else if (t.phase === "exit") { t.x += 120 * dt; if (t.x > width + 100) this.toni = null; } }
    for (const a of this.arrows) { a.x -= 280 * dt; const dx = a.x - player.x; const dy = a.y - player.y; if (dx * dx + dy * dy < 22 * 22) { this.health.takeDamage(1); this.audio.playHit(); this.onHit?.(); a.hit = true; } }
    this.arrows = this.arrows.filter((a) => !a.hit && a.x >= -24);
  }
  draw(ctx) { const t = this.toni; if (t) { const image = this.assets.cache.get(t.phase === "prepare" ? "toni-prepare" : "toni-shoot"); const pulse = t.phase === "shoot" ? 1 + Math.sin(t.elapsed / 4 * Math.PI * 2) * .05 : 1; ctx.save(); ctx.translate(t.x, t.y); ctx.scale(pulse, pulse); if (image?.naturalWidth) ctx.drawImage(image, -80, -80, 160, 160); else { ctx.fillStyle = "#8f443b"; ctx.beginPath(); ctx.arc(0, 0, 72, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); } for (const a of this.arrows) { ctx.save(); ctx.translate(a.x, a.y); ctx.strokeStyle = "#e63946"; ctx.fillStyle = "#e63946"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-12, 0); ctx.lineTo(-6, -5); ctx.moveTo(-12, 0); ctx.lineTo(-6, 5); ctx.stroke(); ctx.restore(); } }
}

/**
 * Spawns prsan airplanes that fly left-to-right and despawn off-screen.
 *
 * Mirrors the ToniManager pattern: a single active enemy at a time, gated by
 * `this.instances.length === 0`, with a global timer driving the next spawn.
 * Easy to extend later (projectiles, waves) by adding fields to the recipe
 * and reading them inside `spawnOne` / the active-instance branch.
 */
export class PrsanManager {
  constructor({ audio, health, recipes = PRSAN_RECIPES, minInterval = 10, maxInterval = 15, spawnMarginTop = 80, spawnMarginBottom = 80 } = {}) {
    this.audio = audio;
    this.health = health;
    this.recipes = recipes;
    this.minInterval = minInterval;
    this.maxInterval = maxInterval;
    this.spawnMarginTop = spawnMarginTop;
    this.spawnMarginBottom = spawnMarginBottom;
    this.instances = [];
    this.timer = 0;
    this.scheduleNext();
  }

  reset() {
    this.instances = [];
    this.timer = 0;
    this.scheduleNext();
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

  spawnOne(width, height) {
    const { key, config } = this.pickRecipe();
    const usableHeight = Math.max(1, height - this.spawnMarginTop - this.spawnMarginBottom);
    const y = this.spawnMarginTop + Math.random() * usableHeight;
    // Pick a random speed per spawn between minSpeed and maxSpeed — keeps
    // each pass unpredictable so the player can't time dodges by rhythm.
    const speed = config.minSpeed + Math.random() * (config.maxSpeed - config.minSpeed);
    // Fly right-to-left: start past the right edge, move in -x. direction: -1
    // flips the sprite horizontally so the plane visually faces the way it's
    // moving (cabin nose points left when flying left).
    const enemy = new EnemyPrsan(width + config.spawnMargin, y, {
      scale: config.scale,
      direction: -1,
      velocityX: -speed,
    });
    this.instances.push({
      enemy,
      recipeKey: key,
      config,
      speed,
      // Short grace period so the plane doesn't immediately re-collide with
      // the player on the same frame it spawns. Tunable per recipe later.
      damageCooldown: 0.4,
    });
    // eslint-disable-next-line no-console
    console.log("[prsan] spawned", { x: enemy.x, y, recipe: key, speed: speed.toFixed(0) });
  }

  update(deltaTime, width, height, player) {
    if (!Number.isFinite(deltaTime) || deltaTime <= 0) return;

    // Toni pattern: tick the global timer; spawn only when there is no
    // active instance. Once an instance exists, just run its life cycle.
    this.timer += deltaTime;

    if (this.instances.length === 0) {
      if (this.timer >= this.nextSpawn) {
        this.timer = 0;
        this.scheduleNext();
        this.spawnOne(width, height);
      }
      return;
    }

    const entry = this.instances[0];
    entry.enemy.update(deltaTime);
    if (entry.damageCooldown > 0) {
      entry.damageCooldown = Math.max(0, entry.damageCooldown - deltaTime);
    }

    // Despawn once fully off the left edge.
    if (entry.enemy.x < -200) {
      this.instances.shift();
      return;
    }

    // Collision: AABB overlap with the player hitbox.
    const playerBounds = player?.getBounds?.();
    if (playerBounds && entry.damageCooldown === 0) {
      const e = entry.enemy.getBounds();
      const overlaps = !(
        e.right < playerBounds.left ||
        e.left > playerBounds.right ||
        e.bottom < playerBounds.top ||
        e.top > playerBounds.bottom
      );
      if (overlaps) {
        this.health?.takeDamage?.(entry.config.damage ?? 1);
        entry.damageCooldown = 0.6;
        // eslint-disable-next-line no-console
        console.log("[prsan] hit player, damage=", entry.config.damage ?? 1);
      }
    }
  }

  draw(ctx) {
    for (const entry of this.instances) entry.enemy.draw(ctx);
  }

  activeItems() {
    return this.instances.length;
  }
}

/**
 * Spawns prsan paratroopers that drift down from the top of the screen.
 *
 * Behaviour notes (matches the brief):
 *   - one descent at a time, gated by `instances.length === 0`
 *   - spawns every 5-15 seconds (configurable via min/maxInterval)
 *   - spawns anywhere along the top edge (random x inside the viewport)
 *   - descent speed and horizontal drift are randomised per spawn so each
 *     jumper feels different — fast vs slow, drift left vs drift right
 *   - the underlying EnemyPrsanPadobran already animates a swing (sin(t*1.65))
 *     and pilot sway inside `getPose()`, so just translating `y` gives a
 *     convincing parachute drift with no extra logic
 *   - no collider / no damage / no scoring — visual only (per brief)
 *   - despawns once it has clearly passed the bottom edge
 */
export class PadobranManager {
  constructor({
    minInterval = 5,
    maxInterval = 15,
    spawnPadding = 80,
    // Pixels above the top edge where the paratrooper appears.
    spawnAboveScreen = 60,
    // Where on the canvas the descent ends — anything past this is gone.
    despawnBelow = 80,
    // Speed range (px/s) for the vertical drop.
    minFallSpeed = 22,
    maxFallSpeed = 42,
    // Horizontal drift range (px/s) — gentle cross-wind.
    minDrift = -14,
    maxDrift = 14,
    // Occasional gust strength (the sprite's puff() uses this).
    gustChance = 0.35,
    gustIntervalMin = 1.6,
    gustIntervalMax = 4.2,
  } = {}) {
    this.minInterval = minInterval;
    this.maxInterval = maxInterval;
    this.spawnPadding = spawnPadding;
    this.spawnAboveScreen = spawnAboveScreen;
    this.despawnBelow = despawnBelow;
    this.minFallSpeed = minFallSpeed;
    this.maxFallSpeed = maxFallSpeed;
    this.minDrift = minDrift;
    this.maxDrift = maxDrift;
    this.gustChance = gustChance;
    this.gustIntervalMin = gustIntervalMin;
    this.gustIntervalMax = gustIntervalMax;
    this.instances = [];
    this.timer = 0;
    this.nextGust = 0;
    this.scheduleNext();
  }

  reset() {
    this.instances = [];
    this.timer = 0;
    this.nextGust = 0;
    this.scheduleNext();
  }

  scheduleNext() {
    const span = Math.max(0, this.maxInterval - this.minInterval);
    this.nextSpawn = this.minInterval + Math.random() * span;
  }

  scheduleGust() {
    const span = Math.max(0, this.gustIntervalMax - this.gustIntervalMin);
    this.nextGust = this.gustIntervalMin + Math.random() * span;
  }

  spawnOne(width, height) {
    const x = this.spawnPadding + Math.random() * Math.max(1, width - this.spawnPadding * 2);
    const y = -this.spawnAboveScreen;
    const fallSpeed = this.minFallSpeed + Math.random() * (this.maxFallSpeed - this.minFallSpeed);
    const drift = this.minDrift + Math.random() * (this.maxDrift - this.minDrift);
    const scale = 0.55 + Math.random() * 0.15;
    const enemy = new EnemyPrsanPadobran(x, y, {
      scale,
      fallSpeed,
      velocityX: drift,
    });
    this.instances.push({ enemy, drift, fallSpeed });
    // eslint-disable-next-line no-console
    console.log("[padobran] spawned", {
      x: x.toFixed(0),
      y: y.toFixed(0),
      fallSpeed: fallSpeed.toFixed(1),
      drift: drift.toFixed(1),
    });
  }

  update(deltaTime, width, height /*, player */) {
    if (!Number.isFinite(deltaTime) || deltaTime <= 0) return;

    this.timer += deltaTime;

    if (this.instances.length === 0) {
      if (this.timer >= this.nextSpawn) {
        this.timer = 0;
        this.scheduleNext();
        this.scheduleGust();
        this.spawnOne(width, height);
      }
      return;
    }

    const entry = this.instances[0];
    entry.enemy.update(deltaTime);

    // Apply a random gust now and then — random push, decaying via the sprite's
    // own gust field (gust *= exp(-dt*1.5) inside EnemyPrsanPadobran.update()).
    this.nextGust -= deltaTime;
    if (this.nextGust <= 0) {
      if (Math.random() < this.gustChance) {
        const strength = (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 1.1);
        entry.enemy.puff(strength);
      }
      this.scheduleGust();
    }

    // Despawn once the parachute clearly clears the bottom edge.
    if (entry.enemy.y > height + this.despawnBelow) {
      this.instances.shift();
      return;
    }

    // Also despawn if a strong sideways drift pushes them well off-screen.
    if (entry.enemy.x < -150 || entry.enemy.x > width + 150) {
      this.instances.shift();
    }
  }

  draw(ctx) {
    for (const entry of this.instances) entry.enemy.draw(ctx);
  }

  activeItems() {
    return this.instances.length;
  }
}
