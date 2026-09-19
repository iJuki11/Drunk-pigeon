# Frame hitching na mobitelu — parallax igra

**Status:** otvoren bug, djelomično umanjen (Faza 8, 18.9.2026.)
**Simptom:** Igra povremeno "cukne" — frame traje 50–200 ms umjesto 16.7 ms (60 fps), pa se parallax i igrački svijet vizualno zaglave za jedan frame.
**Platforma:** najizraženije na mobitelu (Safari iOS, Chrome Android); na desktopu rijetko.
**Cilj:** kad cukanje postane glavni problem, vratiti se na ovaj dokument i riješiti ostatak.

---

## 1. Što je već napravljeno (Faza 8 — 18.9.2026.)

Pet glavnih izvora hitchinga je identificirano i uklonjeno. Backup oznaka: `*.bak.faza8`.

### 1.1. Sky gradient svaki frame
**Datoteka:** `src/game.js`
**Bilo:** `draw()` je svaki frame pozivao `createLinearGradient(0,0,0,height)` + 3 `addColorStop` poziva.
**Fix:** `cachedSkyGradient` se gradi jednom u `resize()`; `draw()` samo čita referencu.
**Efekt:** uklonjena 1 alokacija CanvasGradient + 3 string interpolacije po frameu.

### 1.2. getGroundY() 4× po frameu
**Datoteka:** `src/game.js`
**Bilo:** linija 217 (`update`), 249 (`bounds.top <= 4 || bounds.bottom >= groundY`), 306 (`draw`), 451 (`drawGround`) — svaki put `Number.isFinite + dijeljenje + množenje + Math.round`.
**Fix:** `getGroundY()` sada vraća `this.cachedGroundY`; `computeGroundY()` se zove u `resize()` + kad parallax projekt završi s loadom.
**Efekt:** 240 izračuna/sec → 4 izračuna (samo pri resize/loadu).

### 1.3. 34 PNG-a dekodirana paralelno (prvi frame)
**Datoteka:** `src/game.js` (`loadParallaxBackground`)
**Bilo:** `Promise.all(project.assets.map(decode))` — 34 slike istovremeno dekodira, browser se zaglavi 100–300 ms.
**Fix:**
- Prioritetna lista `SCENE_LAYER_PRIORITY` (road, cafe, house, hedge, lampe → 06c/06b/06a → mid → far → clouds → sun → sky).
- `CONCURRENCY = 4` — max 4 dekodiranja u isto vrijeme.
**Efekt:** foreground vidljiv u prva 2 framea, pozadina "dođe" 100–200 ms kasnije neprimjetno.

### 1.4. UI DOM manipulacija svaki frame
**Datoteka:** `src/ui.js`
**Bilo:** `update()` je 60× u sekundi radio `toLocaleString("hr-HR")` × 2 + `forEach` × 2 + `classList.toggle` × 6+ — DOM operacije čak i kad se ništa nije promijenilo.
**Fix:** cache polja (`lastScoreText`, `lastDistanceText`, `lastBeerText`, `lastHealth`, `lastPoopLevels[]`, `lastCoffeeBoost`) — DOM se piše samo kad se vrijednost stvarno promijeni.
**Efekt:** ublažen najgori DOM pritisak, posebno na slabijim mobitelima.

### 1.5. snapshot() i popups.filter() alokacije
**Datoteka:** `src/game.js`
**Bilo:**
- `snapshot()` je svaki frame pravio novi objekt sa 7 polja (60 objekata/sec za GC).
- `this.popups = this.popups.filter(...)` svaki frame pravio novi array.
**Fix:**
- `this.uiSnapshot` inicijaliziran u konstruktoru; `snapshot()` mutira in-place.
- `popups.splice(i, 1)` s reverznom iteracijom (in-place).
**Efekt:** smanjen GC pritisak za ~60 objekata/sec + N array-eva/sec.

### 1.6. Player spawn safety
**Datoteka:** `src/game.js` (`resize`)
**Bilo:** `player.y = height * 0.44` mogao spawnati ispod tla kad ZOOM < 1.
**Fix:** `player.y = Math.min(height * 0.44, cachedGroundY - player.height)`.

---

## 2. Što JOŠ može uzrokovati cukanje na mobitelu

Analiza ostalih datoteka (Faza 8 pregled) — kandidati za sljedeći krug optimizacije.

### 2.1. `player.draw()` — 31 canvas path operacija svaki frame
**Datoteka:** `src/player.js` (linija 35–96)
**Što radi:** Svaki frame crta 9 zasebnih pathova (tijelo, krila, glava, oko, kljun, noga, sjena, ...) sa `ellipse`, `arc`, `quadraticCurveTo`, `stroke`, `fill` — 31 canvas state promjena.
**Zašto je skupo:** Svaki `fill/stroke` tjera browser da gradi novi path. Na slabijem hardveru ovo može trajati 3–6 ms.
**Rješenje (za budućnost):**
- Pre-rendera player sprite kao unaprijed nacrtanu `OffscreenCanvas` ili `<img>` izvor s frame-ovima animacije krila.
- Sprite ima 3 frame-a (krilo gore / sredina / dolje) i rotira se prema velocityY.
- Prednost: 31 path operacija → 1 `drawImage`.
**Procjena:** ovo je vjerojatno **drugi najveći** hitching izvor nakon PNG dekodiranja.

### 2.2. `collectibles.collect()` i druge "game logike"
**Datoteka:** `src/collectibles.js`, `src/enemies.js`, `src/deckis.js`, `src/poop.js`
**Što rade:** Svaki frame:
- `collectibles.collect(this.player.getBounds())` — vraća novi array.
- Svaki manager ima 1 `filter/map/forEach` i 1 `push/splice`.
**Zašto je OK:** array-evi su mali (5–20 elemenata), alokacije su minorne (reda veličine 100 bajtova).
**Procjena:** vjerojatno **nije** hitching izvor, ali vrijedi provjeriti profiliranjem.

### 2.3. `audio.js` — `new Audio(...)`?
**Datoteka:** `src/audio.js`
**Što ima:** 1 `new Audio()` poziv — vjerojatno u konstruktoru ili lazy-loadu, ne po frameu.
**Zašto je OK:** Web Audio API pool-ovi bi trebali raditi.
**Provjeriti:** jesu li zvučni efekti instancirani svaki put kad se reproduciraju (novi Audio svaki put = loše)?

### 2.4. ParallaxRuntime render — 17 layera × 2 kopije
**Datoteka:** `assets/backgrounds/renderer.js`
**Što radi:** Svaki frame: 17 layera × ~2 kopije = ~30–40 `drawImage` poziva + `ctx.save/restore/translate/scale` × 30–40.
**Zašto je OK:** browser akcelerira drawImage za keširane slike. Na mobitelu s hardware akceleracijom ovo je 2–4 ms.
**Eventualni fix:** Ako je i dalje sporo, smanjiti broj layera (spajanje sun+clouds u jedan layer) — ali to je arhitekturna promjena.

### 2.5. Service Worker / Cache headers
**Datoteka:** `index.html`
**Što fali:** nema service workera, nema `<link rel="preload">` za kritične assete.
**Zašto je problem:** Na mobitelu se svaki reload ponovo fetch-a 5.2 MB parallax JSON + 34 PNG-a. Ako korisnik reload-a ili se app vrati iz backgrounda, ponovo imaš decode spike.
**Rješenje:**
- Service worker koji kešira `background.parallax.json` i asset data URIs (ili same PNG-ove ako se prebace na zasebne datoteke).
- `<link rel="preload" as="image">` za najvažnije sprite-ove.

### 2.6. Frame cap od 0.1 s
**Datoteka:** `src/game.js` (linija ~163)
**Što radi:** `const deltaTime = Math.min(frameTime / 1000, 0.1);`
**Zašto je problem:** Kad se dogodi hitching (npr. 200 ms frame), igra "krene dalje" s deltaTime=0.1, ali player fizički nije ažuriran za stvarni protekli period. Vizualno: igrač asocira na "preskakanje".
**Eventualni fix:** Interpolacija između prethodnog i trenutnog stanja (state interpolation) — render pokazuje `prev_state + alpha * (curr_state - prev_state)` gdje je `alpha = (timestamp - lastUpdateTime) / fixedDeltaTime`.
**Trade-off:** složenije, ali eliminira vizualni "skok" nakon hitchinga.

### 2.7. Asset size — 5.2 MB JSON
**Datoteka:** `assets/backgrounds/background.parallax.json`
**Što ima:** 34 PNG-ova base64-enkodirana u jedan JSON.
**Zašto je problem:** base64 увећава za ~33%, pa je pravi size 34 × (npr. 100 KB) = 3.4 MB → 4.5 MB JSON → 5.2 MB.
**Rješenje:** Izvoz svakog layera kao zasebni PNG umjesto jednog JSON-a s base64. Browser paralelno fetcha 17 slika umjesto da čeka 5.2 MB blob.
**Trade-off:** zahtijeva ponovni izvoz iz editora i refaktor `loadParallaxBackground`.

---

## 3. Kako dijagnosticirati kad se vratiš na ovaj bug

### 3.1. Performance overlay
Dodati u `index.html` (privremeno):
```html
<div id="perf" style="position:fixed;top:8px;left:8px;background:#000c;color:#fff;font:11px monospace;padding:4px;z-index:9999"></div>
<script>
(function(){
  const el = document.getElementById('perf');
  let frames = 0, last = performance.now();
  function tick(t){
    frames++;
    if (t - last >= 500) {
      const fps = Math.round(frames / ((t - last) / 1000));
      el.textContent = fps + ' fps · ' + Math.round(t - last) + 'ms / 500ms';
      frames = 0; last = t;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
</script>
```

### 3.2. Chrome DevTools Performance panel
1. Otvori igru u Chrome (mirroraj mobitel ako treba — `chrome://inspect`).
2. Performance → Record → 5–10 sekundi igranja.
3. Gledaj "Main" thread — gdje su žuti "Scripting" i ljubičasti "Rendering" blokovi?
4. Ako je Scripting > 8 ms po frameu — kriva je JS logika.
5. Ako je Rendering > 8 ms — kriva je canvas paint.
6. Ako su blokovi "garbage collect" — kriva je alokacija.

### 3.3. Safari iOS — Web Inspector
1. Postavke → Safari → Napredno → Web Inspector: ON.
2. Mac Safari → Razvoj → [tvoj iPhone] → stranica.
3. Timeline tab → Record.

---

## 4. Prioritetni plan kad se vratiš

| Faza | Zadatak | Datoteke | Procjena | Očekivani efekt |
|------|---------|----------|----------|-----------------|
| A | Pre-render player sprite u 3 frame-a (krila gore/sred/dol) + rotacija | `src/player.js`, novi `assets/images/custom/` | 2h | -3-6 ms po frameu |
| B | State interpolation za player i parallax worldX | `src/game.js` | 1h | Uklanjanje vizualnih "skokova" nakon hitchinga |
| C | Service Worker za cache parallax asseta | `service-worker.js`, `index.html` | 2h | Brži reload, manje decode spike-a |
| D | Refaktor parallax izvoza — 17 zasebnih PNG-ova umjesto jednog JSON-a | `assets/backgrounds/renderer.js`, `src/game.js`, editor export | 3h | Manji prvi fetch, paralelni download |
| E | Profiliranje u Chrome DevTools — precizno lociranje preostalih hotspotova | n/a | 30min | Točna lista ostalih izvora |

**Preporučeni red:** A → B → C → D (pojedinačno testirati nakon svake).

---

## 5. Testiranje

Prije i poslije svake faze:
1. Hard-refresh (`Cmd+Shift+R` / `Ctrl+Shift+R`).
2. Otvori Performance overlay (gore).
3. Igraj 30 sekundi, zabilježi:
   - Prosječni fps
   - Broj frame-ova > 33 ms (33 ms = 30 fps granica)
   - Najgori frame (peak)
4. Usporedi s ovim baselineom (Faza 8, na iPhone 12 Safari):
   - fps: ~55 prosječno
   - >33 ms frame-ovi: ~5% od ukupnog
   - peak: 80–150 ms (obično prvi frame nakon loada)

---

## 6. Datoteke i reference

- `src/game.js` — glavna petlja, parallax integracija, frame timing
- `src/ui.js` — DOM update, cachirane vrijednosti
- `src/parallax-background.js` — izvor ZOOM_BACKGROUND i SKIP_LAYER_IDS
- `assets/backgrounds/renderer.js` — ParallaxRuntime (editorov output)
- `assets/backgrounds/background.parallax.json` — 5.2 MB parallax data
- `assets/backgrounds/upute.txt` — specifikacija formata (za buduće export refaktore)

## 7. Backup oznake

Svaka faza ima vlastiti backup suffix:
- Faza 1–6: `.bak.fazaN` (legacy, iz stare arhitekture)
- Faza 7: `.bak.faza7` (parallax JSON + cache)
- Faza 8: `.bak.faza8` (UI DOM caching + parallax decode prioritization)

Svi backup fajlovi su preseljeni u `archive/` direktorij u rootu repozitorija — tamo ih traži kad ti treba starija verzija koda ili kad radiš novi backup.

Ako se nešto pokvari, restore s `cp archive/X.js.bak.fazaN src/X.js`.
