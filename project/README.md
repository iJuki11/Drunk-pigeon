# Pivski let

Mobile-first 2D endless flyer browser igra. Golub leti kroz desaturirani grad, skuplja zlatne krigle pive i pokušava ostati u zraku što dulje.

## Lokalno pokretanje

Projekt nema dependencyje niti traži instalaciju paketa. Potreban je samo moderan browser i mali lokalni web server.

1. Otvori Terminal u mapi projekta.
2. Pokreni:

   ```bash
   python3 -m http.server 8080
   ```

3. U browseru otvori [http://localhost:8080](http://localhost:8080).

Za zaustavljanje servera pritisni `Ctrl+C` u Terminalu.

> Nemoj otvarati `index.html` dvoklikom jer browser može blokirati JavaScript module kada se stranica otvara kao lokalna datoteka. Koristi lokalni server iz uputa iznad.

## Kontrole

- Mobitel: tap po prostoru igre
- Desktop: `Space`, strelica gore ili klik mišem
- Cilj: skupljaj pive i ne udari u gornji rub ili krovove grada

## Struktura

```text
index.html
styles/
  style.css
src/
  main.js
  game.js
  player.js
  collectibles.js
  input.js
  ui.js
assets/
  images/
  sounds/
```

Grafika se trenutno crta kroz Canvas kao placeholder. Klase `Player` i `CollectibleManager` odvojene su kako bi se kasnije jednostavno zamijenile finalnim spriteovima.

## GitHub Pages (kasniji korak)

Projekt koristi relativne putanje i ne treba build korak, pa se može objaviti izravno iz root mape repozitorija putem GitHub Pagesa. Za sada deployment nije konfiguriran.
