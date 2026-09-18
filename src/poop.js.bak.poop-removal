export class PoopManager {
  constructor(audio, onHit) { this.audio = audio; this.onHit = onHit; this.cooldown = 5; this.counter = 0; this.poops = []; }
  reset() { this.counter = 0; this.cooldown = 5; this.poops = []; }
  onFlap(x, y) { this.incrementFlap(x, y); }
  incrementFlap(x = 0, y = 0) {
    this.counter += 1;
    if (this.counter < this.cooldown) return false;
    this.counter = 0;
    this.poops.push({ x, y, radius: 12 });
    this.audio.playPoop();
    return true;
  }
  update(dt, height, deckis = []) {
    for (const poop of this.poops) {
      poop.y += 340 * dt;
      const decki = deckis.find((d) => d.active && Math.abs(poop.x - d.x) < 32 && Math.abs(poop.y - d.y) < 32);
      if (decki) { decki.active = false; poop.hit = true; this.audio.playPoopHit(); this.onHit?.(decki.x, decki.y); }
    }
    this.poops = this.poops.filter((p) => !p.hit && p.y <= height + 12);
  }
  draw(ctx) {
    for (const p of this.poops) { ctx.save(); ctx.translate(p.x, p.y); ctx.fillStyle = "#6d4024"; ctx.beginPath(); ctx.ellipse(0, 0, 10, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#a66a3b"; ctx.beginPath(); ctx.arc(3, -2, 3, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  }
}
