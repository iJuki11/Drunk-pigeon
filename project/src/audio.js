export class AudioBus {
  constructor() {
    this.context = null;
    this.master = null;
    this.userInteracted = false;
    this.onUserInput = this.onUserInput.bind(this);
    // Browser policy guard: audio is unlocked only by a real user gesture.
    window.addEventListener("keydown", this.onUserInput, { once: true, passive: true });
    window.addEventListener("pointerdown", this.onUserInput, { once: true, passive: true });
  }

  onUserInput() {
    this.userInteracted = true;
    if (this.context?.state === "suspended") this.context.resume().catch(() => {});
  }

  ensureContext() {
    if (!this.userInteracted || typeof window.AudioContext !== "function" && typeof window.webkitAudioContext !== "function") return null;
    if (!this.context) {
      const Context = window.AudioContext || window.webkitAudioContext;
      this.context = new Context();
      this.master = this.context.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === "suspended") this.context.resume().catch(() => {});
    return this.context;
  }

  tone(frequency, duration, type = "square", endFrequency = frequency, volume = 0.18) {
    const context = this.ensureContext();
    if (!context || !this.master) return;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(Math.min(0.28, volume), now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.01);
  }

  noise(duration, volume = 0.12) {
    const context = this.ensureContext();
    if (!context || !this.master) return;
    const buffer = context.createBuffer(1, context.sampleRate * duration, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    const source = context.createBufferSource();
    const gain = context.createGain();
    gain.gain.setValueAtTime(Math.min(0.28, volume), context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    source.buffer = buffer;
    source.connect(gain).connect(this.master);
    source.start();
  }

  playBeer() { this.tone(440, 0.08, "square", 660, 0.16); }
  playCoffee() { this.tone(330, 0.08, "square", 250, 0.16); }
  playShot() { this.noise(0.2, 0.16); this.tone(180, 0.2, "sawtooth", 900, 0.12); }
  playHit() { this.tone(90, 0.15, "triangle", 45, 0.2); }
  playPoop() { this.tone(180, 0.06, "square", 70, 0.14); }
  playPoopHit() { this.noise(0.12, 0.18); this.tone(220, 0.3, "square", 520, 0.12); }
  playDeckiAppear() { this.noise(0.4, 0.1); this.tone(75, 0.4, "sawtooth", 110, 0.08); }
  playGameOver() {
    [440, 350, 260, 180].forEach((frequency, index) => {
      window.setTimeout(() => this.tone(frequency, 0.14, "square", frequency * 0.8, 0.12), index * 140);
    });
  }
  playPause() { this.tone(600, 0.05, "square", 600, 0.12); }
}
