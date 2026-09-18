export class DeckiManager {
  constructor(assets, audio) { this.assets = assets; this.audio = audio; this.items = []; this.timer = 0; this.nextSpawn = 8; }
  reset() { this.items = []; this.timer = 0; this.nextSpawn = 8 + Math.random() * 7; }
  update(dt, width, groundY) {
    this.timer += dt;
    if (this.timer >= this.nextSpawn && !this.items.some((d) => d.active)) { this.timer = 0; this.nextSpawn = 8 + Math.random() * 7; this.items.push({ x: width + 60, y: groundY - 60, active: true, size: 80 }); this.audio.playDeckiAppear(); }
    for (const d of this.items) if (d.active) d.x -= 50 * dt;
    this.items = this.items.filter((d) => d.active && d.x > -60);
  }
  activeItems() { return this.items; }
  draw(ctx) { const image = this.assets.cache.get("decki"); for (const d of this.items) { if (!d.active) continue; if (image?.naturalWidth) ctx.drawImage(image, d.x - 60, d.y - 60, 120, 120); else { ctx.fillStyle = "#de7e35"; ctx.beginPath(); ctx.arc(d.x, d.y, 48, 0, Math.PI * 2); ctx.fill(); } } }
}
