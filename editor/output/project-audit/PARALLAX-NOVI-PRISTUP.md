# Parallax: analiza nove dostavljene verzije i prijedlog arhitekture

Ovo je pregled novog zalijepljenog `game.js` i matematički prijedlog sljedeće izmjene. Nova implementacija nije napisana ni testirana. Renderer dostupan u mapi `project` i dalje je verzija pregledana ranije; ako Hermes ima noviji renderer, treba provjeriti i njega prije izmjene.

## Konkretni problemi u novom game.js

U dostavljenom kodu, oko linija 248–280:

1. `phase` i `localBreath = Math.sin(...)` računaju se globalno iz `worldX / 4500`. To nije lokalno stanje jedne kopije niti povrat isključivo izvan kadra; pomiču se i trenutno vidljivi objekti.
2. `sceneWithLocalOffsets` mijenja `object.x`, ali ostavlja `layer.parallax`. Uz dostupni renderer, položaj je i dalje `originalX + k * 4500 - worldX * layer.parallax + sineOffset`. Dodavanje pomaka ±10 px ne može zaustaviti razilaženje od stotina piksela koje uzrokuju različite stare brzine.
3. Faza sinusa koristi period kamere 4500. Kafić uz stari parallax 0.78 vraća se nakon 4500 / 0.78 ≈ 5769.23 px kamere. Ti periodi nisu usklađeni.
4. U svakom `draw()` stvaraju se novi objekti scene/slojeva/elemenata. To je nepotrebno alociranje i mogući doprinos GC zastajkivanju, ali bez mjerenja frameova nije dokaz uzroka opaženog trzaja.
5. `loadParallaxBackground()` učitava slike jednom, a početak igre nije uvjetovan završetkom tog učitavanja. Igra može krenuti s proceduralnom pozadinom i usred prikaza prijeći na PNG pozadinu. To može objasniti početni vizualni skok, ali ne dokazuje uzrok ponavljanog trzaja na svakom krugu.
6. Nema novog kontrolera/stanja kopija u dostavljenom `game.js`. Ako je implementiran u novom rendereru, potreban je i taj kod za potvrdu. Iz ovog izvora ne može se tvrditi da se na svakom krugu slike ponovno učitavaju.

## Ispravak koncepta: isti period u svijetu, različiti periodi u projekciji

Prethodne upute previše su se oslanjale na recikliranje blokova i male dodatne pomake. Ključna razlika je koordinatni sustav: stari sustav ima svim slojevima isti razmak kopija na ekranu, a različite brzine. Zato imaju različito vrijeme povratka. Jednostavno resetiranje to ne popravlja bez dodatnih uvjeta na vidljivost i pokrivanje.

Za novi sustav definirati jedan ponavljajući svijet duljine `L = 4500`. Kamera `C` napreduje kontinuirano u tom svijetu. Svaki sloj ima faktor dubine `d > 0`. Projekcija sloja skalira **i prostorne položaje/razmake i brzinu**, ne samo brzinu.

Konceptualno, prije zajedničkog `ZOOM_BACKGROUND` i preslikavanja na ekran:

```js
const C = worldX * CITY_SPEED;
const L = scene.loop.end - scene.loop.start;
const worldXOfCopy = object.x + k * L;

const drawX = anchorX + depth * (worldXOfCopy - C - anchorX);
const drawY = scene.groundY + depth * (object.y - scene.groundY);
const drawWidth = object.width * depth;
const drawHeight = object.height * depth;
```

`anchorX` je stalno projekcijsko sidro izraženo u koordinatama scene. Najjednostavnije 0; ako se koristi drugo sidro, dosljedno ga uključiti i u izračun vidljivog raspona. Prikazna razina tla i globalni zoom ostaju zasebna završna transformacija.

Za sloj dubine `d`, razmak kopija nakon projekcije je **`L * d`**, a pomak kamere **`C * d`**. Zato im je vrijeme povratka jednako. Primjer s `anchorX=0`:

```text
drawX(k+1, C+L)
  = d * (object.x + (k+1)*L - (C+L))
  = d * (object.x + k*L - C)
  = drawX(k, C)
```

To vrijedi istodobno za sve dubine. Nakon što kamera prođe `L` svjetskih piksela, sva pozadina ponavlja isti kadar. Nema sinusa, globalnog reseta, interpoliranog vraćanja ni nasljeđivanja pomaka prethodne kopije. Objekti na različitim dubinama pritom imaju stvarno različitu projekcijsku brzinu.

Za `anchorX=0`, ako je širina vidljivog kadra prije završne skale `V`, culling za taj sloj koristi svjetski interval `[C, C + V / d]`. Za drugo sidro treba invertirati istu projekciju. Ne koristiti isti broj kopija za sve dubine. Vrlo udaljeni sloj može pokazivati više perioda u jednom kadru.

## Zašto se kafić i vodotoranj ne smiju tretirati kao udaljeni slojevi

Prepoznatljivi dijelovi iste ulice kojima se želi sačuvati međusobni razmak pripadaju istoj fizičkoj dubini: kafić, vodotoranj, crkva i ostali glavni orijentiri, te ograda/živica koja zatvara njihove spojeve. Za njih uzeti `depth = 1` i zajedničku projekciju. Oni ostaju zasebni layeri radi crtanja, ali ne putuju različitim brzinama kroz isti ulični prostor.

Parallax ostaje na stvarno odvojenim dubinama: udaljeni grad, srednji grad, drugi redovi zgrada koji nisu sastavni dio neprekinute ulice, oblaci. Time se ne ukida parallax igre. Ako i pojedine bliske građevine trebaju različitu dubinu, njihov raspored mora biti projektiran za takvu projekciju i provjeren tijekom cijelog prolaza. Ne može se istodobno zahtijevati da par zgrada ima različite projekcijske brzine i da im međusobni razmak bude strogo konstantan.

To znači da ranije grupiranje svih 12 slojeva bez razlike nije nužno, ali nije ispravno ni očekivati da svaki sloj iste fizičke ulice zadrži potpuno neovisnu brzinu bez posljedica. Granica grupa treba slijediti prostorni sadržaj, ne samo nazive layera.

## Posljedice za postojeće PNG-ove i izgled

- Izvorni PNG dijelovi 4096 + 404 ostaju dijelovi istog svjetskog perioda. Oba dijela projicirati istim `depth`. Njihove širine i X razmak moraju zajedno postati `4096*d` i `404*d`.
- **Nije dovoljno samo promijeniti razmak kopija.** Ako slike ostanu iste širine, a razmak se smanji, preklapat će se. Ako se promijeni samo brzina, vraća se stari problem.
- Dubina u novom modelu nije sinonim za staru vrijednost `layer.parallax`. Stare vrijednosti 0.025, 0.16 itd. ne kopirati naslijepo: projekcijski bi vrlo snažno smanjile cijeli sadržaj tih slojeva. Faktor odabrati prema željenom izgledu i pripremiti izgled svake dubine.
- Novi način projekcije mijenja veličinu i raspored udaljenih slojeva u odnosu na stari statični pano. Treba jednom uskladiti početni izgled; zatim će svaki prolaz tog izgleda biti identičan. Ako se traži doslovno očuvanje svake koordinate i dimenzije starog panoa, nije moguće samo uključiti novu dubinsku projekciju bez prilagodbe scene.
- Za preciznu kontrolu pojedinih građevina najbolje je koristiti izvorni projekt sa zasebnim elementima. Već spojeni layer ne dopušta premještanje ili dodjelu zasebne dubine samo jednom objektu unutar PNG-a.
- Opaque podloge već pokrivaju puni interval svog sloja. Praznine u transparentnom sadržaju nisu greška tilinga; pokrivanje treba osigurati neprekinutom pozadinskom podlogom i odgovarajućim grupiranjem fizički spojenih elemenata.
- Nebo ostaje jedan gradijent preko cijelog ekrana, bez skaliranja s dubinom i bez ponovnog crtanja PNG sloja `sky` preko njega.

## Izvedba bez trzaja na granici perioda

- Slike učitati/dekodirati jednom i pripremiti prije početka runde, uz vidljivo stanje učitavanja.
- Ne raditi `fetch`, `Image.decode`, rekonstrukciju atlasa ili velike kopije scene pri povratku kafića.
- U `draw()` samo izračunati vidljive indekse `k` i nacrtati postojeće slike. Nije potreban događaj „reset na 4500”. Kopije koje su izvan kadra jednostavno se ne crtaju. Eventualni pool mijenja samo male zapise za nevidljive kopije.
- Ukloniti globalni sinus i mapiranje cijele scene u svakom frameu.
- Mjeriti trajanje frameova i promjene `worldX`. Razlikovati stvarni spor frame od vizualnog skoka uz normalno trajanje framea. Dostavljeni kod nije dovoljan za sigurno pripisivanje svih trzaja jednom uzroku.

## Točna mjesta buduće izmjene

- Novi dostavljeni `game.js:248–280`: ukloniti `localBreath` i `sceneWithLocalOffsets`. To nije traženi sustav.
- `assets/backgrounds/renderer.js`, funkcije `render()` i `instances()`: računati zajedničku svjetsku kameru i projekciju svih geometrijskih veličina po dubini; pravilno invertirati projekciju za culling. Provjeriti stvarnu najnoviju verziju koju Hermes ima.
- `game.js`, učitavanje i `start()`: pripremiti slike prije početka igre. `ZOOM_BACKGROUND` primijeniti točno jednom na rezultat.
- Konfiguracija/podaci scene: eksplicitno razdvojiti `CITY_SPEED`, dubinske faktore i `ZOOM_BACKGROUND`; fizički povezanim dijelovima dodijeliti zajedničku dubinu.

## Provjere nakon implementacije

Prvo napraviti mali prototip na stvarnim slikama, prije zamjene cijele igre. Pri istoj referentnoj kameri usporediti piksele pozadine na `C`, `C+L`, `C+3L`, `C+100L`. Iz usporedbe isključiti gameplay i HUD. Dodatno provjeriti spoj PNG dijelova, cijeli prolaz između početnih faza, razmake glavnih građevina, nekoliko zoomova i široki kadar. Posebno profilirati prvi kadar i granice ponavljanja. Ne proglašavati ovaj prijedlog potvrđenim rješenjem dok to nije provedeno.
