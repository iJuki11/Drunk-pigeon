export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.velocityY = 0;
    this.width = 50;
    this.height = 34;
    this.rotation = 0;
    this.wingPhase = 0;
  }

  flap() {
    this.velocityY = -390;
    this.wingPhase = Math.PI;
  }

  update(deltaTime) {
    const gravity = 1040;
    this.velocityY += gravity * deltaTime;
    this.velocityY = Math.min(this.velocityY, 570);
    this.y += this.velocityY * deltaTime;
    this.rotation = Math.max(-0.42, Math.min(0.72, this.velocityY / 650));
    this.wingPhase += deltaTime * 12;
  }

  getBounds() {
    return {
      left: this.x - this.width * 0.38,
      right: this.x + this.width * 0.38,
      top: this.y - this.height * 0.36,
      bottom: this.y + this.height * 0.38,
    };
  }

  draw(context) {
    const flapOffset = Math.sin(this.wingPhase) * 7;

    context.save();
    context.translate(this.x, this.y);
    context.rotate(this.rotation);

    context.fillStyle = "rgba(0, 0, 0, 0.18)";
    context.beginPath();
    context.ellipse(-1, 17, 24, 5, 0, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#747a7c";
    context.beginPath();
    context.moveTo(-11, 5);
    context.quadraticCurveTo(-31, -14 - flapOffset, -36, -3 - flapOffset);
    context.quadraticCurveTo(-28, 8, -9, 11);
    context.fill();

    context.fillStyle = "#aeb2b2";
    context.beginPath();
    context.ellipse(-2, 2, 24, 15, -0.08, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#5e6567";
    context.beginPath();
    context.ellipse(12, -5, 13, 12, 0.12, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#3f8a82";
    context.beginPath();
    context.arc(7, 2, 8, 0.4, 2.7);
    context.lineTo(12, 8);
    context.fill();

    context.fillStyle = "#e5e6e1";
    context.beginPath();
    context.arc(16, -9, 3.4, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#202326";
    context.beginPath();
    context.arc(17, -9, 1.45, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#b7853c";
    context.beginPath();
    context.moveTo(24, -5);
    context.lineTo(34, -1);
    context.lineTo(24, 2);
    context.closePath();
    context.fill();

    context.strokeStyle = "#5b6061";
    context.lineWidth = 3;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(-17, 4);
    context.quadraticCurveTo(-4, -16 + flapOffset, 12, 2);
    context.stroke();

    context.restore();
  }
}
