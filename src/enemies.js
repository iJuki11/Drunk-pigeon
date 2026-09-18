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
