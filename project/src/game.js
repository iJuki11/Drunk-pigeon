import { Player } from "./player.js";
import { CollectibleManager } from "./collectibles.js";

const STATE = Object.freeze({
  START: "start",
  PLAYING: "playing",
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
    this.popups = [];
    this.collectibles = new CollectibleManager();
    this.player = new Player(90, 300);

    this.frame = this.frame.bind(this);
    this.resize = this.resize.bind(this);
    window.addEventListener("resize", this.resize);
    document.addEventListener("visibilitychange", () => {
      this.lastTime = performance.now();
    });

    this.resize();
    this.ui.showStart();
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

    if (this.state !== STATE.PLAYING) {
      this.player.x = this.width * 0.25;
      this.player.y = this.height * 0.44;
    }
  }

  start() {
    this.distance = 0;
    this.beers = 0;
    this.score = 0;
    this.speed = 170;
    this.worldX = 0;
    this.popups = [];
    this.collectibles.reset();
    this.player = new Player(this.width * 0.25, this.height * 0.45);
    this.player.flap();
    this.state = STATE.PLAYING;
    this.input.setEnabled(true);
    this.ui.update(this.snapshot());
    this.ui.showPlaying();
    this.lastTime = performance.now();
  }

  end() {
    if (this.state !== STATE.PLAYING) return;
    this.state = STATE.GAME_OVER;
    this.input.setEnabled(false);
    this.ui.showGameOver(this.snapshot());
  }

  snapshot() {
    return {
      score: this.score,
      distance: this.distance,
      beers: this.beers,
    };
  }

  frame(timestamp) {
    if (!this.lastTime) this.lastTime = timestamp;
    const deltaTime = Math.min((timestamp - this.lastTime) / 1000, 0.034);
    this.lastTime = timestamp;

    this.update(deltaTime);
    this.draw();
    requestAnimationFrame(this.frame);
  }

  update(deltaTime) {
    const ambientSpeed = this.state === STATE.PLAYING ? this.speed : 22;
    this.worldX += ambientSpeed * deltaTime;

    if (this.state !== STATE.PLAYING) return;

    if (this.input.consumeFlap()) this.player.flap();

    this.player.update(deltaTime);
    this.speed = Math.min(255, 170 + this.distance * 0.05);
    this.distance += this.speed * deltaTime * 0.055;
    this.score = Math.floor(this.distance) + this.beers * 100;

    const groundY = this.getGroundY();
    this.collectibles.update(deltaTime, this.speed, this.width, this.height, groundY);
    const collectedItems = this.collectibles.collect(this.player.getBounds());

    for (const item of collectedItems) {
      this.beers += 1;
      this.score = Math.floor(this.distance) + this.beers * 100;
      this.popups.push({ x: item.x, y: item.y, age: 0, value: "+100" });
    }

    for (const popup of this.popups) {
      popup.age += deltaTime;
      popup.y -= 34 * deltaTime;
    }
    this.popups = this.popups.filter((popup) => popup.age < 0.85);

    this.ui.update(this.snapshot());

    const bounds = this.player.getBounds();
    if (bounds.top <= 4 || bounds.bottom >= groundY) this.end();
  }

  getGroundY() {
    return this.height - Math.max(46, this.height * 0.065);
  }

  draw() {
    const context = this.context;
    context.clearRect(0, 0, this.width, this.height);
    this.drawSky(context);
    this.drawClouds(context);
    this.drawSkyline(context, 0.16, this.height * 0.52, "#969c9e", 54, 105);
    this.drawSkyline(context, 0.34, this.height * 0.68, "#737a7c", 68, 150);
    this.drawSkyline(context, 0.62, this.height * 0.79, "#50575a", 84, 210);
    this.drawGround(context);

    this.collectibles.draw(context);
    this.player.draw(context);
    this.drawPopups(context);
    this.drawVignette(context);
  }

  drawSky(context) {
    const gradient = context.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, "#c7cbca");
    gradient.addColorStop(0.55, "#aeb4b5");
    gradient.addColorStop(1, "#858c8e");
    context.fillStyle = gradient;
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
