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
- Git repo je u `/workspace` (root, ne unutar `/project`) — bez commitova

## Existing architecture (observed)

- **Game loop**: vjerojatno `requestAnimationFrame` u `Game` klasi
  (nije izravno pročitano — samo potvrđeno da `Game` postoji i drži
  `Player` + `CollectibleManager`)
- **State machine**: `STATE` enum (frozen object) u `game.js` — koristi
  se za start/playing/game-over prijelaze
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