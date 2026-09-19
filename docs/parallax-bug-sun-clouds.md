# Parallax bug — sun i oblaci nestaju na spoju petlje

**Status:** privremeno riješeno u `game.js` filtriranjem (Faza 9, 18.9.2026.)
**Trajni fix:** potreban u editorovom loop-only exportu

---

## Simptom

Sun i oblaci se pojave, klize, pa **nestanu na otprilike 9% vremena** prije nego se ponove. Izgleda kao da se "dupliciraju" jer se ritmički pojavljuju i nestaju.

Konkretno:
- Kamera putuje od `worldX = 0` do `worldX ≈ 64285 px` (jedan puni ciklus oblaka)
- Unutar tog ciklusa, oblaci su vidljivi ~91% vremena
- Preostalih ~9% vidljiv je samo prazan gradijent neba

Za sunce je još gore — period je `4500 / 0.025 = 180000 px`, pa se ciklus ponavlja tek svaka 3+ minute igre, ali je efekt isti.

## Root cause

Loop-only export iz Parallax Editora dijeli svaki layer na **dva PNG dijela**:
- **dio 1**: `x = 0 → 4096` (sprite 4096 px širine)
- **dio 2**: `x = 4096 → 4500` (sprite 404 px širine)

To je ispravno prema `assets/backgrounds/upute.txt` — dijelovi su susjedni dijelovi iste petlje i ponavljaju se svakih 4500 px.

Ali u praksi:

| Layer | dio 1 sadržaj | dio 2 sadržaj |
|-------|--------------|--------------|
| nebo | ✅ gradijent cijelog dijela | ✅ gradijent cijelog dijela |
| daleki grad | ✅ silueta | ✅ silueta (nastavak) |
| srednji grad | ✅ | ✅ nastavak |
| kuće | ✅ 4 kuće + stabla | ✅ wraparound rub |
| **sun** | ☀️ 1 sunce na ~X=1280 | ❌ **potpuno prazno** |
| **oblaci** | ☁️☁️☁️☁️ 4 oblaka | ❌ **potpuno prazno** |

Sun i oblaci su u editoru pozicionirani samo u lijevom dijelu scene (X < 4096). Kad ParallaxRuntime prijeđe fazu 4096, viewport treba pokazati dio 2 — ali tamo nema ničega za te layere.

## Zašto ostali layeri rade ispravno

Layeri koji imaju **pozadinu/siluetu preko cijelog X raspona** (nebo, daleki grad, srednji grad, kuće sa wraparound rubom) ispravno se ponavljaju jer njihov PNG sadrži piksele u cijelom `[0, 4500)` rasponu.

Sun i oblaci su **diskretni elementi** — u editoru su postavljeni na specifične X pozicije unutar `[0, 4096)`. Izvoz je vjerno prenio njihov položaj, ali wrapper PNG-ovi za dio 2 nemaju ništa jer u originalnoj sceni nema elemenata tamo.

## Trenutni fix (Faza 9)

U `src/game.js` `loadParallaxBackground()`, filtriran je `parallaxSceneCache` da ne uključuje `sun` i `clouds`:

```js
.filter((layer) =>
  layer.id !== "sky" &&
  layer.id !== "sun" &&
  layer.id !== "clouds" &&
  !SKIP_LAYER_IDS.has(layer.id)
)
```

Time:
- ✅ Igra nema vizualni bug (nestajanje oblaka/sunca)
- ✅ Nekoliko PNG-ova manje za dekodirati (2 layera × 2 PNG-a = 4 slike)
- ❌ Izgubljen vizualni element (sunce i oblaci)
- ⚠️ Dekodiranje ostalih layera sada započinje ranije (priority lista ažurirana)

## Preporučeni trajni fix — opcija A

Otvori `parallax-editor/output/parallax-editor/editor.html` (ili tvoj lokalni editor) i:

1. Postavi scenu na širinu 4500 px (Loop End).
2. U layeru **Oblaci** dodaj barem jedan oblak u rasponu `X = 4096 → 4500` da popuni dio 2.
3. U layeru **Sunce** učini isto — dodaj drugu instancu ili kopiju u `X = 4096 → 4500`.
4. Alternativno: koristi opciju "Ispuni petlju" (gumb u kartici "Petlja") da automatski dupliciraš elemente.
5. Re-izvezi: "Preuzmi samo petlju za igru".

Nakon toga ukloni filter za `sun` i `clouds` iz `game.js` i vrati opacity tweak ako želiš.

## Preporučeni trajni fix — opcija B (programerski)

Patch `assets/backgrounds/renderer.js` da podrži **period-po-layeru**:

```js
// Umjesto:
//   const L = scene.loop.end - scene.loop.start;
// dodati:
//   const L = layer.period ?? scene.loop.end - scene.loop.start;
```

Tada u editoru (ili post-procesiranjem JSON-a) možeš za `sun` i `clouds` postaviti `layer.period = 4500 * X` gdje je `X` cijeli broj veći od 1, npr. 2 ili 3. Time bi se oblaci ponavljali svakih 9000 ili 13500 px umjesto 4500.

**Trade-off:** period ≠ loop end znači da se faza oblaka neće resetirati na `loop.end`. Za ovo je potrebna i izmjena formule `offset % L` da koristi `layer.period` kao modul.

## Preporučeni trajni fix — opcija C (već implementirana)

Vidjeti "Trenutni fix" gore. Brzo, sigurno, ali gubi vizualni element.

## Datoteke

- `src/game.js` — `loadParallaxBackground()`, `parallaxSceneCache` filter
- `src/parallax-background.js` — `SKIP_LAYER_IDS`
- `assets/backgrounds/background.parallax.json` — izvor podataka
- `editor/output/parallax-editor/` — mjesto gdje je scena uređivana
- `assets/backgrounds/upute.txt` — specifikacija loop-only exporta

## Backup oznake

- Faza 9: `*.bak.faza9`

Svi backup fajlovi su preseljeni u `archive/` direktorij u rootu repozitorija — tamo ih traži kad ti treba starija verzija koda ili kad radiš novi backup.
