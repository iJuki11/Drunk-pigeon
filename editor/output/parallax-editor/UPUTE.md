# Scena — editor parallax pozadine

Otvorite **editor.html** u pregledniku. To je samostalna datoteka s ugrađenim slikama; za rad nisu potrebni internet, server ni instalacija. Biblioteka uključuje 44 jedinstvena dosad izrađena asseta: pojedinačne zgrade, kafić, veliku kuću, vegetaciju, ograde, cestu, atmosferu, lampe, lika s lukom, poravnate slojeve i spojene varijante pozadine.

## Složite scenu

1. U popisu lijevo odaberite sloj. Vrh popisa crta se ispred ostalih. U kartici **Sloj** promijenite naziv, parallax, vidljivost, prozirnost ili redoslijed. Ikona kvadrata označava zaključan sloj; kliknite je za otključavanje.
2. Kliknite asset u biblioteci ili ga povucite na platno. Dodaje se u aktivni sloj. Gumb **+ Slika** dodaje vlastite PNG, JPG ili WebP datoteke.
3. Kliknite element i povlačite ga. Kutne ručke mijenjaju veličinu. Kartica **Element** nudi precizne X/Y koordinate, širinu i visinu, premještanje u drugi sloj, zrcaljenje, dupliciranje i prozirnost. Omjer stranica se čuva dok je kvačica uključena; Shift tijekom povlačenja kutne ručke privremeno dopušta slobodnu promjenu omjera.
4. Koristite **Na tlo**, **Na početak petlje**, **Na kraj petlje** ili **Ispuni petlju** za poravnanje. Poništavanje i ponavljanje dostupni su gore lijevo.

Pomak prikaza: držite Space i povlačite. Zoom: kotačić miša ili +/−. **Uklopi** vraća pregled cijele scene. **Mreža** uključuje vodilice; **Snap 10 px** poravnava položaj i veličinu pri povlačenju.

## Uvod i infinite loop

U kartici **Petlja** odredite početak i kraj segmenta, primjerice 1000 i 5000 px. Dio prije 1000 px je uvod, a segment duljine 4000 px ponavlja se. Svaki sloj pomiče se svojom parallax brzinom.

Element ima tri načina ponavljanja:

- **Prema položaju u sceni**: X gornjeg lijevog kuta prije početka petlje znači jednokratni element uvoda; X unutar segmenta znači ponavljajući element. Element izvan desnog kraja ostaje jednokratan dok ga ne pomaknete unutar segmenta ili mu izričito zadate ponavljanje.
- **Uvijek u petlji**: element se ponavlja kroz cijeli segment. Dio preko kraja automatski se prikazuje na početku. Ponavljajuće kopije ne crtaju se prije početka petlje.
- **Samo jednom / uvod**: element se pojavljuje jednom na zadanom X, bez obzira na granice petlje.

Kad promijenite duljinu ili početak, gumb **Popuni podloge do rubova petlje** prilagođava ugrađeno nebo, udaljeni grad i cestu novim granicama. Po potrebi dodaje zasebne dijelove za uvod. Kuće, vegetacija i ostali ručno postavljeni elementi zadržavaju svoje položaje. Ovu promjenu možete poništiti.

**Spoj petlje** stavlja kraj i početak jedan uz drugi. Okomita linija pokazuje spoj. Pomičite i povećavajte elemente izravno u tom prikazu; promjena kopije uređuje isti original. Kvačica **U spoju gledaj samo aktivni sloj** pomaže provjeriti jedan sloj bez zaklanjanja ostalima. Šahovska podloga otkriva praznine.

**Vožnja** prikazuje stvarni parallax. Kamera raste neprekidno; editor je ne resetira na kraju petlje. Tako se na granici ne stvara skok svih slojeva. Spoj sadržaja vizualno provjerite nakon svojeg raspoređivanja — editor prikazuje ponavljanje, ali ne pretvara proizvoljnu sliku automatski u seamless teksturu.

**Pregled širine mobitela** mijenja širinu kadra na 480 px, bez promjene duljine petlje. Ponovni klik vraća 2172 px.

## Spremanje i predaja Hermesu

Za **samo odabrani komad koji se ponavlja u igri**, u kartici **Petlja** kliknite **Preuzmi samo petlju za igru**. Primjerice, početak 0 i kraj 4500 izvoze isključivo taj raspon, bez sadržaja izvan njega. Datoteka `Naziv-petlja.parallax.json` sadrži zasebne PNG-ove po vidljivom sloju, njegovu prozirnost, redoslijed i parallax te renderer. Dugi slojevi podijeljeni su u susjedne PNG dijelove; cijeli raspon i dalje čini jednu petlju. Početak izvoza pomiče se na 0. Širina kadra ostaje zasebna od duljine petlje.

Ovaj izvoz reže ono što je ručno složeno u odabranom pravokutniku. Ne dodaje kopije elemenata izvana i ne čini rubove automatski vizualno neprimjetnima. Za provjeru točnog rezultata možete otvoriti izvezeni JSON u editoru i pogledati **Spoj petlje** ili **Vožnju**. **Prije toga sačuvajte cijeli projekt**: u izvezenoj petlji elementi unutar pojedinog sloja spojeni su u slike, pa se pojedinačne kuće uređuju u izvornom projektu. Gumb za izvoz ne mijenja otvorenu scenu.

**Preuzmi projekt** sprema jednu datoteku **Naziv.parallax.json**. Uključuje:

- sve korištene slike, ugrađene kao podatke, bez lokalnih putanja;
- slojeve i njihov redoslijed, vidljivost, prozirnost i parallax;
- položaj, veličinu, zrcaljenje i način ponavljanja svakog elementa;
- visinu scene, širinu kadra, razinu tla i početak/kraj petlje;
- referentni Canvas 2D renderer s istim pravilima kao u editoru.

**To je jedina datoteka koju treba poslati Hermesu.** Hermes može izdvojiti slike ili ih učitati izravno iz ugrađenih podataka. U mapi postoji i zasebni `renderer.js` kao pogodnost; nije potreban uz JSON jer je isti sadržaj uključen u izvoz.

**Otvori projekt** vraća taj JSON u editor. Editor također automatski sprema lokalnu kopiju u preglednik. Ta kopija ovisi o pregledniku i njegovoj pohrani; preuzeti JSON služi za prijenos i sigurnu kopiju. Pri uvozu projekta ugrađeni JavaScript se ne izvršava — koristi se renderer ugrađen u editor.

**PNG prikaza** služi za vizualni pregled. PNG je spojen prikaz i ne zamjenjuje JSON s odvojenim elementima.

## Prečaci

⌘/Ctrl Z — poništi; ⌘/Ctrl Shift Z ili Ctrl Y — ponovi; ⌘/Ctrl D — dupliciraj element; ⌘/Ctrl S — preuzmi projekt; Delete — ukloni element; strelice — pomak 1 px; Shift + strelice — pomak 10 px; P — animacija; F — uklopi prikaz; Space + povlačenje — pomak prikaza.

Editor je namijenjen prvenstveno radu na računalu. Scena sprema pozadinske assete i raspored; ne sprema kolizije ili logiku igre.
