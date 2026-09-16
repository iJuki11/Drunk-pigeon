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

## Deployment

- **GitHub Pages** je planirani deployment target (još nije konfiguriran);
  build korak nije potreban.