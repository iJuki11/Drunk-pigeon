export class Health {
  constructor(max = 3) {
    this.max = Math.max(1, max);
    this.current = this.max;
  }

  takeDamage(amount = 1) {
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
