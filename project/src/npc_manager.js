// NPCManager — orchestrates all non-enemy, atmospheric characters.
//
// A NPC (Non-Player Character) here means anything that floats, drifts,
// or otherwise populates the world but does NOT damage the player. This is
// the home for visual flavour: paratroopers, balloons, debris, etc.
//
// Design rules followed by every sub-manager:
//   - one method, one responsibility
//   - sub-managers expose: update(), draw(), reset()
//   - active instances live in `instances[]` and are ticked every frame
//   - spawn gating: at most one active instance per type at a time
//   - timers and randomness stay inside the sub-manager, not in the parent

import { NPCPrsan } from "./npc_prsan.js";

/**
 * Sub-manager for the "prsan" paratrooper NPC.
 *
 * Owns its own spawn timer, gust timer, and the array of active prsan
 * instances. The outer NPCManager just delegates update/draw/reset here.
 */
export class NPCPrsanManager {
  constructor({
    minInterval = 5,
    maxInterval = 15,
    spawnPadding = 80,
    spawnAboveScreen = 60,
    despawnBelow = 80,
    minFallSpeed = 22,
    maxFallSpeed = 42,
    minDrift = -14,
    maxDrift = 14,
    gustChance = 0.35,
    gustIntervalMin = 1.6,
    gustIntervalMax = 4.2,
  } = {}) {
    // Settings are stored individually so each has a clear purpose — easier
    // to tweak from the outside or feed from config later.
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

    // Initialise both timers so the first frame has predictable state.
    this.scheduleNext();
    this.scheduleGust();
  }

  /** Roll a random duration until the next spawn attempt. */
  scheduleNext() {
    const span = Math.max(0, this.maxInterval - this.minInterval);
    this.nextSpawn = this.minInterval + Math.random() * span;
  }

  /** Roll a random duration until the next gust impulse. */
  scheduleGust() {
    const span = Math.max(0, this.gustIntervalMax - this.gustIntervalMin);
    this.nextGust = this.gustIntervalMin + Math.random() * span;
  }

  /**
   * Create one prsan instance with randomised descent parameters.
   * Returns the new instance so callers (tests, debug overlays) can grab it.
   */
  spawnOne(width, height) {
    const x = this.spawnPadding + Math.random() * Math.max(1, width - this.spawnPadding * 2);
    const y = -this.spawnAboveScreen;
    const fallSpeed = this.minFallSpeed + Math.random() * (this.maxFallSpeed - this.minFallSpeed);
    const drift = this.minDrift + Math.random() * (this.maxDrift - this.minDrift);
    const scale = 0.55 + Math.random() * 0.15;

    const prsan = new NPCPrsan(x, y, {
      scale,
      fallSpeed,
      velocityX: drift,
    });
    this.instances.push(prsan);
    return prsan;
  }

  /** Tick timers and walk every active instance forward by deltaTime. */
  update(deltaTime, width, height) {
    if (!Number.isFinite(deltaTime) || deltaTime <= 0) return;

    this.timer = (this.timer || 0) + deltaTime;

    // Spawn gate: at most one prsan alive at a time. The original brief
    // asked for this so the screen doesn't fill up with parachutes.
    if (this.instances.length === 0 && this.timer >= this.nextSpawn) {
      this.timer = 0;
      this.scheduleNext();
      this.scheduleGust();
      this.spawnOne(width, height);
    }

    // Step every instance, then drop any that have drifted past the bottom.
    for (const prsan of this.instances) {
      prsan.update(deltaTime);
    }
    this.despawnIfOffscreen(height);
    this.applyRandomGust(deltaTime);
  }

  /** Remove any instance whose pose has fallen below the visible canvas. */
  despawnIfOffscreen(height) {
    this.instances = this.instances.filter(
      (prsan) => prsan.y < height + this.despawnBelow,
    );
  }

  /** Occasionally nudge an active prsan with a short wind gust. */
  applyRandomGust(deltaTime) {
    if (this.instances.length === 0) return;
    this.nextGust -= deltaTime;
    if (this.nextGust <= 0) {
      if (Math.random() < this.gustChance) {
        const strength = (Math.random() - 0.5) * 2; // -1..+1
        this.instances[0].puff(strength);
      }
      this.scheduleGust();
    }
  }

  /** Render every active instance via its own draw method. */
  draw(context) {
    for (const prsan of this.instances) {
      prsan.draw(context);
    }
  }

  /** Wipe all instances and reset timers — called on game restart. */
  reset() {
    this.instances = [];
    this.timer = 0;
    this.nextGust = 0;
    this.scheduleNext();
    this.scheduleGust();
  }
}

/**
 * NPCManager — top-level facade for every NPC type in the game.
 *
 * Currently owns a single sub-manager (prsan). New sub-managers can be
 * registered by adding a property here and forwarding update/draw/reset
 * calls in the corresponding methods below. The contract for any new
 * sub-manager is the same three methods: update, draw, reset.
 */
export class NPCManager {
  constructor() {
    this.Prsan = new NPCPrsanManager();
  }

  update(deltaTime, width, height) {
    this.Prsan.update(deltaTime, width, height);
  }

  draw(context) {
    this.Prsan.draw(context);
  }

  reset() {
    this.Prsan.reset();
  }
}