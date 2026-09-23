(() => {
  const panel = document.createElement("aside");
  panel.id = "jev-preview-panel";
  panel.innerHTML = `<strong>Jev pilot</strong><div class="jev-status">Waiting for game…</div><div class="jev-choice">—</div><div class="jev-probs"></div><small class="jev-meta">Local preview · API key stays on server</small><button class="jev-toggle" type="button">Pauziraj Jeva</button>`;
  Object.assign(panel.style, {
    position: "fixed", zIndex: "99999", top: "12px", right: "12px", width: "250px",
    padding: "12px 14px", borderRadius: "12px", color: "#f5f7fa", background: "rgba(14,20,29,.92)",
    border: "1px solid rgba(255,255,255,.2)", boxShadow: "0 8px 30px #0006",
    font: "13px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace", pointerEvents: "auto",
  });
  panel.querySelector("strong").style.cssText = "display:block;font:700 15px/1.3 system-ui;margin-bottom:7px;color:#9ee6ff";
  document.body.append(panel);
  const status = panel.querySelector(".jev-status");
  const choice = panel.querySelector(".jev-choice");
  const probs = panel.querySelector(".jev-probs");
  const meta = panel.querySelector(".jev-meta");
  const toggle = panel.querySelector(".jev-toggle");
  meta.style.cssText = "display:block;margin-top:8px;opacity:.65;font:10px system-ui";
  toggle.style.cssText = "display:block;margin-top:9px;padding:6px 10px;border:1px solid #75b8d2;border-radius:6px;background:#22485d;color:white;cursor:pointer";
  let pending = false;
  let lastCall = 0;
  let lastAction = "glide";
  let slowed = false;
  let running = true;
  let callCount = 0;
  const MAX_CALLS_PER_SESSION = 60;

  toggle.addEventListener("click", () => {
    const game = window.__game;
    running = !running;
    if (running) {
      callCount = 0;
      lastCall = -Infinity;
      if (game?.state === "paused") game.resume();
      toggle.textContent = "Pauziraj Jeva";
      status.textContent = "Jev nastavlja…";
    } else {
      if (game?.state === "playing") game.pause();
      toggle.textContent = "Nastavi Jeva";
      status.textContent = "Jev pauziran";
    }
  });

  function gameState(game) {
    const player = game.player;
    const obstacles = [];
    for (const entry of game.airplaneManager?.instances ?? []) {
      const enemy = entry.enemy;
      obstacles.push({ x: enemy.x, y: enemy.y, vx: enemy.velocityX ?? -entry.speed, radius: 48 });
    }
    for (const entry of game.birdManager?.instances ?? []) {
      const bird = entry.bird;
      obstacles.push({ x: bird.x, y: bird.y, vx: bird.velocityX ?? -entry.speed, radius: 42 });
    }
    obstacles.sort((a, b) => Math.abs(a.x - player.x) - Math.abs(b.x - player.x));
    return {
      x: player.x, y: player.y, velocityY: player.velocityY,
      groundY: game.getGroundY(), ceilingY: 4,
      obstacles: obstacles.slice(0, 6),
    };
  }

  async function ask(game) {
    pending = true;
    callCount += 1;
    lastCall = performance.now();
    status.textContent = "Asking Jev…";
    try {
      const response = await fetch("/__jev/decide", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gameState(game)),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || `HTTP ${response.status}`);
      lastAction = data.action;
      const probabilities = data.probabilities || {};
      const pct = (value) => `${Math.round((Number(value) || 0) * 100)}%`;
      choice.textContent = `Decision: ${data.action.toUpperCase()}`;
      probs.textContent = `flap ${pct(probabilities.flap)} · glide ${pct(probabilities.glide)}`;
      status.textContent = `Model: ${data.model}`;
      meta.textContent = `${data.latencyMs} ms · confidence ${pct(data.confidence)}`;
    } catch (error) {
      status.textContent = "Jev request failed";
      choice.textContent = error.message;
      probs.textContent = "Bot paused until next request";
      meta.textContent = "Check server output and API key";
    } finally {
      pending = false;
    }
  }

  // The game's own start/replay buttons preserve its state lifecycle and input wiring.
  const lifecycle = window.setInterval(() => {
    const game = window.__game;
    if (!game) return;
    if (!slowed) {
      // Slow simulation while keeping smooth rendering so decisions arrive
      // before the bird crosses the safe flight corridor.
      const originalUpdate = game.update.bind(game);
      game.update = (deltaTime) => originalUpdate(deltaTime * 0.4);
      slowed = true;
      lastCall = -Infinity;
      meta.textContent = "Preview speed 0.4× · API key stays on server";
    }
    if (!running) return;
    if (callCount >= MAX_CALLS_PER_SESSION) {
      running = false;
      if (game.state === "playing") game.pause();
      toggle.textContent = "Nastavi Jeva";
      status.textContent = "Pauza nakon 60 Jev odluka";
      return;
    }
    if (game.state !== "playing") {
      if (game.state === "start" || game.state === "game-over") {
        if (game.state === "start") {
          game.ui.hideLoadingImmediate();
          game.ui.showStart();
        }
        const button = game.state === "start" ? document.querySelector("#play-button") : document.querySelector("#replay-button");
        if (button && !button.disabled) button.click();
      }
      return;
    }
    if (pending) return;
    if (lastAction === "flap") {
      game.input.flapRequested = true;
      lastAction = "glide";
    }
    if (performance.now() - lastCall >= 700) ask(game);
  }, 80);
  window.addEventListener("beforeunload", () => clearInterval(lifecycle));
  status.textContent = "Auto-starting…";
})();
