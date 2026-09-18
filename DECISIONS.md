# DECISIONS.md

Durable technical and product decisions. Samo odluke koje su jasno
zapisane u projektu (README, kod ili struktura). Razlozi koji nisu
nigdje dokumentirani ovdje ne navode se.

## 2026-09-16 — Workspace bootstrap

- Projekt slijedi tri-agent workflow (Orchestrator / Coder / Reviewer)
  definiran u `/workspace/.hermes.md`.
- Tri datoteke (`PROJECT_STATE.md`, `CURRENT_PLAN.md`, `DECISIONS.md`)
  su durable project memory i žive u rootu workspacea.

## Product (iz `project/README.md`)

- **Igra je "Pivski let"** — endless flyer, golub skuplja pive iznad
  grada.
- **Mobile-first** — tap je primarna kontrola; desktop kontrole
  (Space, strelica gore, klik) su sekundarne.
- **Cilj:** ostati u zraku što dulje, izbjegavati gornji rub i krovove,
  skupljati pive.
- **Jezik:** hrvatski (HR) — sav copy, opisi, kontrole.

## Tech (iz koda i README-a)

- **Vanilla JavaScript (ES modules), HTML5, CSS3** — bez frameworka,
  bez bundlera, bez package managera.
- **Canvas 2D** za cijelu scenu igre; HUD i ekrani su DOM.
- **`Player` i `CollectibleManager` odvojeni u vlastite module** kako
  bi se kasnije zamijenili finalnim spriteovima bez diranja ostatka
  igre.
- **Relativne putanje u svim resursima** (`./styles/style.css`,
  `./src/main.js`) — zato se projekt može objaviti izravno s GitHub
  Pagesa bez build koraka.
- **`index.html` se ne smije otvarati dvoklikom** — ES moduli zahtijevaju
  HTTP origin; pokretanje ide kroz lokalni web server.
- **Lokalni server (preporuka iz README):** `python3 -m http.server 8080`.

## Engine / arhitektura (vidljivo iz koda)

- **`STATE` je `Object.freeze(...)` enum** u `game.js` — fiksni
  strojno-tipizirani statevi za životni ciklus runde.
- **`seededNoise(seed)`** u `game.js` — grad se generira deterministički,
  ne nasumično između seansi.
- **`Game` klasa** u `game.js` drži `Player` i `CollectibleManager`
  instance — jedan entry point za igru.
- **`InputController`** u `input.js` apstrahira touch, tipkovnicu i miš
  u jedan signal prema `Game`-u.
- **`GameUI`** u `ui.js` manipulira isključivo DOM-om (HUD + ekrani)
  preko ID-eva iz `index.html`.

## 2026-09-16 — Pause/Resume mehanizam

- **Tipka:** `Escape` je primarna, `P` je alias. Obje rade kao toggle
  i ignoziraju `event.repeat` (držanje ne šalje više toggleova).
- **`STATE.PAUSED`** je zaseban state u enumu, ne flag.
- **One-shot signal:** `pauseRequested` je odvojeni boolean koji
  `consumePause()` čita jednom i resetira — tako input callback ne
  mora znati za game state, a game loop čita kad je spreman.
- **`lastTime` reset na resume:** `resume()` postavlja
  `lastTime = performance.now()` da prvi delta nakon nastavka bude
  ~0, ne "cijelo vrijeme pauze". Sprječava player da odleti preko
  ekrana ako je pauza trajala satima.
- **Update-during-pause:** kad je `STATE.PAUSED`, preskače se
  `Player.update()` i `worldX` inkrement ali frame se i dalje crta
  — korisnik vidi scenu smrznutu ispod overlay-a.
- **Pauza izvan `PLAYING` je no-op:** START i GAME_OVER ekrani
  ne reagiraju na Escape/P — toggle radi samo dok je runda aktivna.
- **Pauza overlay je DOM (ne canvas):** full-screen `div` u
  `index.html`, stiliziran u `styles/style.css`. Izolira UI prikaz
  od game loopa, ne troši canvas draw pozive, i nasljeđuje postojeći
  dizajn jezik ostalih ekrana.
- **README:** Lokalno pokretanje eksplicitno upozorava da se
  `index.html` NE smije otvarati dvoklikom jer browser blokira
  ES module na `file://` originu. Pokretanje ide kroz
  `python3 -m http.server 8080`.

## 2026-09-17 — Background integracija (ParallaxRuntime)

- **Format:** `scena-parallax` v1, eksport iz parallax editora
  (zaseban od starih `parallax-city/manifest.json` formata).
  Sadrži `scene` (canvas/groundY/loop/layers[]), `assets[]` (PNG-ovi
  kao data URI), `rendering.rendererSource` (referentni renderer
  kod).
- **Loader:** Renderer dolazi kao `assets/backgrounds/renderer.js`
  (CommonJS/browser UMD-style), izložen kao `globalThis.ParallaxRuntime`.
  Učitan preko `<script src="./assets/backgrounds/renderer.js">` u
  `index.html` (prije ESM `<script type="module" src="./src/main.js">`)
  jer CommonJS `module.exports` nije kompatibilan s dinamičkim
  `import()`.
- **API:** `ParallaxRuntime.render(ctx, scene, images, cameraX, options)`
  s opcijama `width` (canvas CSS px), `height` (canvas CSS px),
  `viewportWidth` (authored scene width, 2172 px).
- **Asset loading:** `game.js` async u konstruktoru čita
  `assets/backgrounds/Moj-grad.parallax.json` (fetch) i dekodira svih
  26 PNG-ova s `Image().decode()`. Pohranjuje ih u `Map<id, Image>`.
- **Fallback:** Ako parallax ne učita, `draw()` koristi proceduralni
  drawSky/drawClouds/drawSkyline/drawGround/seededNoise iz
  originalnog game.js — proceduralni kod je zadržan, ne obrisan.
- **Proceduralni kod očuvan:** drawSky, drawClouds, drawSkyline,
  drawGround, seededNoise funkcije ostaju u game.js kao fallback.
  Coder u `t_3a520817` ih je vratioja pravno nakon Faze 1 brisanja.
- **Loop wraparound:** `scene.loop.end = 4500` px. `worldX` linearno
  raste u endless flyeru; renderer interno rješava wraparound.

## Deployment

- **GitHub Pages** je planirani deployment target (još nije konfiguriran);
  build korak nije potreban.