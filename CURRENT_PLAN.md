# CURRENT_PLAN.md

Aktivni i povijesni implementation planovi. Samo završeni planovi
ostaju — otvoreni/idući poslovi imaju vlastiti task na Kanbanu.

---

## ✅ Done 2026-09-16 — Pause/Resume + lokalno pokretanje (Pivski let)

**Opseg:**
- Dodan `STATE.PAUSED` u state enum; `togglePause()` + helperi
  `pause()` / `resume()` koji se zovu iz input controllera.
- `Escape` primarna tipka, `P` kao alias; obje kao toggle,
  `event.repeat` ignoriran. Pauza je no-op izvan `PLAYING` (npr. iz
  `START` / `GAME_OVER`).
- Tijekom `PAUSED` update preskače `Player.update()` i `worldX`
  pomicanje, ali frame se i dalje crta (canvas ostaje živ). `resume()`
  resetira `lastTime` preko `performance.now()` da prvi delta ne bude
  ogroman nakon višeminutne pauze.
- Pauza overlay je DOM `div` (full-screen, zatamnjen, centriran,
  veliki font) — ne canvas overlay, da izolira UI prikaz od game
  loopa i da se može stilizirati kroz postojeći `styles/style.css`.
- README lokalno pokretanje sad eksplicitno upozorava na
  `file://` + ES module problem (ne dvoklik na `index.html`).

**Verifikacija:** Implementer (Cody) + Reviewer (Tester) oba prošli
svih 14 acceptance criteria (state enum, toggle logika, input
binding, render-during-pause, lastTime reset, README upozorenje,
nema novih dependencyja).

**Datoteke dirane:** `project/src/game.js`, `project/src/input.js`,
`project/src/ui.js`, `project/index.html`, `project/styles/style.css`,
`project/README.md`.

**Sljedeće (out of scope):** Sprite zamjena, score storage, mobilni
test na stvarnom uređaju, build/deploy konfiguracija.