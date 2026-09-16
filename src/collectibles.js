const BEER_SIZE = 36;

export class CollectibleManager {
  constructor() {
    this.items = [];
    this.spawnTimer = 0;
    this.nextSpawn = 0.8;
  }

  reset() {
    this.items = [];
    this.spawnTimer = 0;
    this.nextSpawn = 0.75;
  }

  update(deltaTime, speed, width, height, groundY) {
    this.spawnTimer += deltaTime;
    if (this.spawnTimer >= this.nextSpawn) {
      this.spawnTimer = 0;
      this.nextSpawn = 1.25 + Math.random() * 0.85;
      const safeTop = Math.max(120, height * 0.17);
      const safeBottom = Math.max(safeTop + 80, groundY - 70);
      this.items.push({
        x: width + BEER_SIZE,
        y: safeTop + Math.random() * (safeBottom - safeTop),
        size: BEER_SIZE,
        phase: Math.random() * Math.PI * 2,
        collected: false,
      });
    }

    for (const item of this.items) {
      item.x -= speed * deltaTime;
      item.phase += deltaTime * 4;
    }

    this.items = this.items.filter((item) => item.x > -BEER_SIZE && !item.collected);
  }

  collect(playerBounds) {
    const collected = [];
    for (const item of this.items) {
      const radius = item.size * 0.38;
      const closestX = Math.max(playerBounds.left, Math.min(item.x, playerBounds.right));
      const closestY = Math.max(playerBounds.top, Math.min(item.y, playerBounds.bottom));
      const distanceX = item.x - closestX;
      const distanceY = item.y - closestY;

      if (distanceX * distanceX + distanceY * distanceY < radius * radius) {
        item.collected = true;
        collected.push(item);
      }
    }
    return collected;
  }

  draw(context) {
    for (const item of this.items) {
      const bob = Math.sin(item.phase) * 4;
      const scale = 1 + Math.sin(item.phase * 0.7) * 0.035;
      drawBeer(context, item.x, item.y + bob, scale);
    }
  }
}

function drawBeer(context, x, y, scale) {
  context.save();
  context.translate(x, y);
  context.scale(scale, scale);

  context.shadowColor = "rgba(245, 184, 46, 0.55)";
  context.shadowBlur = 18;
  context.fillStyle = "#f5b82e";
  context.strokeStyle = "#fff0bf";
  context.lineWidth = 3;

  context.beginPath();
  context.roundRect(-13, -15, 23, 31, 5);
  context.fill();
  context.stroke();

  context.shadowBlur = 0;
  context.beginPath();
  context.roundRect(9, -9, 11, 18, 5);
  context.stroke();

  context.fillStyle = "#fff4cb";
  context.beginPath();
  context.roundRect(-14, -17, 25, 8, 4);
  context.fill();

  context.fillStyle = "rgba(255, 255, 255, 0.35)";
  context.fillRect(-8, -5, 3, 14);
  context.restore();
}
