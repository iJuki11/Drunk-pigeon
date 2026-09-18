export class Health {
  constructor(max = 3) {
    this.max = Math.max(1, max);
    this.current = this.max;
    // Optional predicate: invoked with no args; if it returns true, the
    // incoming damage is ignored. Game.js wires this to the player's
    // invincibility window so post-hit frames don't drain extra HP.
    this.isInvincible = null;
  }

  takeDamage(amount = 1) {
    if (typeof this.isInvincible === "function" && this.isInvincible()) return this.current;
    const damage = Math.max(0, Number(amount) || 0);
    this.current = Math.max(0, this.current - damage);
    return this.current;
  }

  isDead() {
    return this.current <= 0;
  }

  reset() {
    this.current = this.max;
    return this.current;
  }

  getCurrent() {
    return this.current;
  }
}
