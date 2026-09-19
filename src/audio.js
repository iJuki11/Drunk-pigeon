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
  playHit() { this.tone(90, 0.15, "triangle", 45, 0.2); }
  playGameOver() {
    [440, 350, 260, 180].forEach((frequency, index) => {
      window.setTimeout(() => this.tone(frequency, 0.14, "square", frequency * 0.8, 0.12), index * 140);
    });
  }
  // ---- Background music ---------------------------------------------------
  // Long-form music tracks need a real <audio> element because Web Audio
  // oscillators can't loop MP3s. We route the element through a separate
  // gain so the SFX master stays at its own volume.
  playMusic(src = "./assets/sounds/gogomuck.mp3", volume = 0.3) {
    if (typeof window === "undefined") return;
    if (!this.musicElement) {
      this.musicElement = new Audio();
      this.musicElement.loop = true;
      this.musicElement.preload = "auto";
      this.musicElement.volume = Math.max(0, Math.min(1, volume));
    } else if (this.musicElement.src !== new URL(src, window.location.href).href) {
      this.musicElement.src = src;
    } else {
      this.musicElement.volume = Math.max(0, Math.min(1, volume));
    }
    this.musicElement.src = src;
    // Browser policy: playback may fail without a user gesture; ignore the
    // rejection — the next interaction will trigger this again.
    const playPromise = this.musicElement.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }
  }

  stopMusic() {
    if (!this.musicElement) return;
    this.musicElement.pause();
    this.musicElement.currentTime = 0;
  }

  setMusicVolume(volume) {
    if (!this.musicElement) return;
    this.musicElement.volume = Math.max(0, Math.min(1, volume));
  }

  // ---- Airplane SFX -------------------------------------------------------
  // The prsan airplane uses a looping airplane.mp3 whose volume ramps based
  // on the player's horizontal distance to the enemy: loud when close,
  // quiet when the plane is at the screen edge, silent off-screen. Call
  // updateAirplaneSound(x) every frame while an instance is alive.
  startAirplane(src = "./assets/sounds/airplane.mp3", maxVolume = 0.25) {
    if (typeof window === "undefined") return;
    if (!this.airplaneElement) {
      this.airplaneElement = new Audio();
      this.airplaneElement.loop = true;
      this.airplaneElement.preload = "auto";
      this.airplaneElement.volume = 0;
    }
    if (this.airplaneElement.src !== new URL(src, window.location.href).href) {
      this.airplaneElement.src = src;
    }
    this.airplaneMaxVolume = Math.max(0, Math.min(1, maxVolume));
    const p = this.airplaneElement.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  }

  // volume from 0..1 — call every frame with the plane's x position; the
  // helper maps distance-from-center to a bell-shaped gain curve.
  updateAirplaneSound(planeX, playerX, canvasWidth) {
    if (!this.airplaneElement) return;
    const center = canvasWidth / 2;
    // Normalised distance: 0 at center, 1 at far edge.
    const distanceFromCenter = Math.min(1, Math.abs(planeX - center) / (canvasWidth / 2));
    // Bell curve: loudest at distance 0.4 (plane mid-flight), quiet at edges.
    // peak = 1 at d=0.4, falls off to 0 at d=0 and d=1.
    const bell = 1 - Math.pow((distanceFromCenter - 0.4) / 0.6, 2);
    const targetVolume = Math.max(0, Math.min(1, bell)) * this.airplaneMaxVolume;
    // Smooth ramp to avoid clicks/pops.
    const current = this.airplaneElement.volume;
    this.airplaneElement.volume = current + (targetVolume - current) * 0.15;
  }

  stopAirplane() {
    if (!this.airplaneElement) return;
    this.airplaneElement.pause();
    this.airplaneElement.currentTime = 0;
    this.airplaneElement.volume = 0;
  }

  // ---- Bird SFX -----------------------------------------------------------
  // The crow uses the same looping-volume pattern as the airplane — a
  // separate Audio element so airplane and bird can play simultaneously.
  // updateBirdSound() ramps volume on a bell curve so the caw rises and
  // falls as the bird crosses the screen. Same shape as the airplane, so
  // both enemies read identically across the playfield.
  startBird(src = "./assets/sounds/crow.mp3", maxVolume = 0.25) {
    if (typeof window === "undefined") return;
    if (!this.birdElement) {
      this.birdElement = new Audio();
      // Looping caw — bell-curve volume makes it feel alive, not flat.
      this.birdElement.loop = true;
      this.birdElement.preload = "auto";
      this.birdElement.volume = 0;
    }
    if (this.birdElement.src !== new URL(src, window.location.href).href) {
      this.birdElement.src = src;
    }
    this.birdMaxVolume = Math.max(0, Math.min(1, maxVolume));
    const p = this.birdElement.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  }

  // volume from 0..1 — call every frame with the bird's x position; the
  // helper maps distance-from-center to a bell-shaped gain curve. Same
  // math as updateAirplaneSound so the bird and airplane both peak at
  // d=0.4 and fall off at the edges.
  updateBirdSound(birdX, playerX, canvasWidth) {
    if (!this.birdElement) return;
    const center = canvasWidth / 2;
    // Normalised distance: 0 at center, 1 at far edge.
    const distanceFromCenter = Math.min(1, Math.abs(birdX - center) / (canvasWidth / 2));
    // Bell curve: loudest at distance 0.4 (bird mid-flight), quiet at edges.
    // peak = 1 at d=0.4, falls off to 0 at d=0 and d=1.
    const bell = 1 - Math.pow((distanceFromCenter - 0.4) / 0.6, 2);
    const targetVolume = Math.max(0, Math.min(1, bell)) * this.birdMaxVolume;
    // Smooth ramp to avoid clicks/pops.
    const current = this.birdElement.volume;
    this.birdElement.volume = current + (targetVolume - current) * 0.15;
  }

  stopBird() {
    if (!this.birdElement) return;
    this.birdElement.pause();
    this.birdElement.currentTime = 0;
    this.birdElement.volume = 0;
  }
}
