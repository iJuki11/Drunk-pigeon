# PROJECT_STATE.md

Durable state of the project. Orchestrator maintains this file.

## Purpose

**Pivski let** — mobile-first 2D endless flyer browser igra. Golub leti
kroz desaturirani grad, skuplja zlatne krigle pive i pokušava ostati
u zraku što dulje. Izvor: `/workspace/project/README.md`.

Jezik projekta: hrvatski (HR) — copy, kontrole, opisi na HR-u.

## Tech stack

- **HTML5 + CSS3 + vanilla JavaScript (ES modules)** — bez frameworka
- **Canvas 2D** — sva grafika se crta proceduralno kroz Canvas (placeholder
  spriteovi, planirana zamjena finalnim slikama)
- **Bez build alata, bez bundlera, bez package managera**
- Staticki serving putem bilo kojeg lokalnog web servera (preporuka:
  `python3 -m http.server 8080`)

## Main modules / components

```
/workspace/project/
├── index.html               # Entry HTML; mounta canvas, HUD, start/game-over ekrane
├── styles/
│   └── style.css            # 409 linija — sav styling (responsive, mobile-first)
├── src/
│   ├── main.js              # 13 linija — bootstrap: instancira Game, InputController, GameUI
│   ├── game.js              # 275 linija — glavna petlja, STATE enum, Game klasa, seededNoise()
│   ├── player.js            #  97 linija — Player klasa (golub, fizika leta)
│   ├── collectibles.js      #  95 linija — CollectibleManager + drawBeer() procedura
│   ├── input.js             #  38 linija — InputController (touch + tipkovnica + miš)
│   └── ui.js                #  53 linija — GameUI (HUD update, ekrani)
└── assets/
    ├── images/              # prazno (samo .gitkeep)
    └── sounds/              # prazno (samo .gitkeep)
```

## Important entry points

- **Browser entry:** `/workspace/project/index.html` (lang="hr", mobile
  viewport meta, theme-color, inline SVG favicon)
- **JS bootstrap:** `/workspace/project/src/main.js` —
  ```js
  import { Game } from "./game.js";
  import { InputController } from "./input.js";
  import { GameUI } from "./ui.js";
  ```
  Pokreće `Game` klasu iz `game.js` (koja vuče `Player` i
  `CollectibleManager`)
- **Moduli (ES module exports):**
  - `Game` u `src/game.js`
  - `Player` u `src/player.js`
  - `CollectibleManager` u `src/collectibles.js`
  - `InputController` u `src/input.js`
  - `GameUI` u `src/ui.js`

## Build / test commands

Nema build koraka, nema testova, nema lintanja. Postoje samo:

| Radnja | Naredba |
|---|---|
| Lokalni server | `cd /workspace/project && python3 -m http.server 8080` |
| Otvaranje u browseru | `http://localhost:8080` |
| Deploy (predviđeno, ne konfigurirano) | GitHub Pages iz root repozitorija (relativne putanje) |

Napomena iz README-a: **ne otvarati `index.html` dvoklikom** — browser
može blokirati ES module kad se stranica učita kao `file://`.

## Current known state

- Svi moduli postoje, kod je raspoređen i radi kao cjelina
- Grafika je **proceduralna** — Canvas crta goluba, pive, krovove i grad
  ručno; README eksplicitno kaže da su `Player` i `CollectibleManager`
  odvojeni "kako bi se kasnije jednostavno zamijenili finalnim spriteovima"
- `assets/images/` i `assets/sounds/` prazni (samo `.gitkeep`) — nema
  još vanjskih resursa
- README navodi: "**Grafika se trenutno crta kroz Canvas kao placeholder**"
- HUD prikazuje: rezultat, broj piva, udaljenost u metrima
- Dva ekrana: start-screen i game-over-screen, plus canvas + HUD
- Kontrole (sve tri istovremeno aktivne):
  - Mobitel: tap
  - Desktop: `Space`, strelica gore, klik mišem
- **Pause/resume radi (2026-09-16):** `STATE.PAUSED` je dodan u enum;
  `Escape` je primarna tipka, `P` je alias — obje djeluju kao toggle.
  Tijekom pauze update preskače simulaciju i `worldX` ali frame se i
  dalje crta; `resume()` resetira `lastTime` preko `performance.now()`
  kako bi prvi delta nakon nastavka bio ~0. Pauza overlay je DOM
  element (ne canvas) i izolira UI prikaz od game loopa.
- **Parallax editor dostavljen (2026-09-17):**
  `assets/00_Materijali/parallax-city/editor.html` (41 KB, 1128 linija,
  single-file). Otvara se kroz lokalni HTTP server
  (`python3 -m http.server 8765` unutar `parallax-city/`).
  Originalni `preview.html` netaknut kao backup u
  `.editor-scratch/preview.html.bak`.
  Features: layer solo/toggle/brzina, sprite library za dodavanje,
  per-building editor (x/y/w/h numeric inputs + drag + delete +
  duplicate), seamless overlay (žuta isprekidana linija + label
  `SEAM @ worldX=N`), viewport scale slider (0.1× / 0.25× / 0.5× / 1×),
  URL hash sync (share postavki kao link),
  Export manifest.json patch (diff vs original) + Export game.js
  settings snippet. Verificirano u Playwrightu (headless Chromium):
  add/edit/delete/drag/export/scale/scale-overlay rade bez errora.

- **Background integracija dovršena (2026-09-17):**
  Author je eksportirao `assets/backgrounds/Moj-grad.parallax.json`
  (9.4 MB, format `scena-parallax` v1, 17 layera, 26 ugrađenih
  base64 PNG-ova, loop span 0..4500). Author je naknadno dostavio
  i `assets/backgrounds/renderer.js` (40 linija, CommonJS/browser
  UMD-style, globalni API `ParallaxRuntime.render(ctx, scene, images,
  cameraX, options)`) + `assets/backgrounds/upute.txt` od drugog AI
  agenta kao referentni renderer.
  **Faza 1 (DONE — `t_26af475c`)** Coder je pokušao napisati vlastiti
  BackgroundRenderer — fixan bug ali output zastario jer je author
  naknadno dostavio referentni renderer.
  **Faza 2 (DONE — `t_3a520817` + `t_5ec2f646`)** Coder je resetirao
  game.js na originalno proceduralno stanje i integrirao
  `ParallaxRuntime` preko `<script>` taga u `index.html` (odabrana
  opcija A jer renderer.js koristi CommonJS `module.exports` koji
  nije kompatibilan s ESM dinamičkim `import()`). game.js:
  - `index.html:92` — `<script src="./assets/backgrounds/renderer.js">`
    učitava renderer i postavlja `globalThis.ParallaxRuntime`
  - `game.js:50` — `this.parallaxProject = null`
  - `game.js:215-228` — async setup: fetch JSON + dekôdira 26 PNG-ova
    u `Map<id, HTMLImageElement>`, postavlja `this.parallaxProject`
  - `game.js:234-245` — `draw()` poziva
    `ParallaxRuntime.render(ctx, scene, images, worldX, {...})`
    kad je projekt spreman
  - `game.js:246-253` — proceduralni fallback (drawSky/drawClouds/
    drawSkyline/drawGround) ako parallax ne učita
  - Proceduralni kod (drawSky/drawClouds/drawSkyline/drawGround/
    seededNoise) **zadržan** kao fallback, ne obrisan
  Tester je odobrio s 10-check smoke testom (168 drawImage poziva,
  25/25 loop wraparound, camera responsiveness, multi-viewport,
  asset integrity). Browser/Playwright 30-60s test nije pokrenut
  (Chromium nedostupan u Docker workspaceu) — headless Node test
  korišten kao zamjena.
  **Fix scale-a (`t_25b33e62`)**: Originalni ParallaxRuntime radi
  `ctx.scale(width/viewport, height/scene.height)` — ne-uniform
  scale koji rasteže scenu na wide viewportima. Coder je zamijenio
  s **uniform scale + centriranje** (aspect-ratio `contain`):
  scena se ne rasteže, ali wide viewporti (npr. 1280×720, 16:9)
  imaju crni letterbox sa strane. Na portrait viewportima (480×800,
  ~3:5) nema letterboxa jer je scene aspect (3:1) blizu viewporta.
  Testirano u Playwrightu na 1280×720 (letterbox vidljiv, scena
  pravilno scale-ana) i 480×800 (puna scena bez letterboxa).
- Git repo je u `/workspace` (root, ne unutar `/project`) — bez commitova

## Existing architecture (observed)

- **Game loop**: vjerojatno `requestAnimationFrame` u `Game` klasi
  (nije izravno pročitano — samo potvrđeno da `Game` postoji i drži
  `Player` + `CollectibleManager`)
- **State machine**: `STATE` enum (frozen object) u `game.js` — koristi
  se za start/playing/paused/game-over prijelaze. `STATE.PAUSED` je
  zaseban state; `togglePause()` je no-op izvan `PLAYING` (npr. iz
  `START` ili `GAME_OVER`)
- **Scenarij**: golub s gravitacijom, skuplja pive (zlatne krigle),
  izbjegava gornji rub ekrana i krovove grada — `seededNoise()`
  u `game.js` sugerira deterministički generirani grad
- **UI**: DOM-based (HUD + ekrani u HTML-u, a canvas je samo scena);
  `GameUI` klasa manipulira DOM elementima preko ID-ova
- **Input**: jedna klasa apstrahira touch / keyboard / mouse u jedan
  signal

## Important risks / unknowns

- **Nema testova niti lintanja** — regresije se mogu uhvatiti samo
  ručnim igranjem
- **Nema build koraka** — relativne putanje u `index.html` (`./styles/...`,
  `./src/main.js`) su nužne za GitHub Pages, ali lomljive ako netko
  pokuša bundlati u budućnosti
- **`.DS_Store`** je prisutan u `/workspace/project/` — trebao bi ići u
  `.gitignore`
- **`assets/`** prazni direktori samo drže `.gitkeep` — ako netko počne
  brisati "nepotrebne" datoteke, izgubit će se struktura za buduće
  spriteove/zvukove
- **Nema backend-a / score storagea** — rezultat se ne sprema
- **Nema iOS Safari / Android Chrome specifičnih provjera** — touch
  input postoji ali README ne potvrđuje testiranje na stvarnim
  uređajima
- **Canvas placeholder grafika** je privremena; zamjena spriteovima
  nije započela — opseg i konačni art style još nisu odlučeni
- **State machine prijelazi** nisu potvrđeno pročitani (samo deklariran
  `STATE` enum); eventualni bugovi u start/playing/over logici nisu
  mapirani