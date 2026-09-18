# Zasebni elementi za igru

Pakiranje uključuje dva stabla, sivu ogradu, zasebnu živicu i zaseban kameni zid, nebo s gradijentom, sunce, četiri pojedinačna oblaka i dva sloja udaljenoga grada.

## Odabir datoteka

- **sprites/**: obrezani samostalni PNG elementi s prozirnom pozadinom. Koristite ih za slobodno postavljanje i neovisni parallax. Oblaci su podijeljeni u cloud-01 do cloud-04.
- **layers/**: isti elementi pripremljeni na zajedničkom platnu **2172 × 724 px**, s predloženim položajima. Svaki PNG crtati od x=0, y=0. Nebo je neprozirno, ostali slojevi imaju alfa kanal.
- **background.png**: spoj neba, dalekog i srednjeg grada, bez sunca, oblaka i prednjih objekata. Ovo je jednostavnija alternativa tim trima zasebnim slojevima; za puni parallax koristite ih odvojeno.
- **manifest.json**: dimenzije, predloženi položaji i brzine za Hermes. Položaji odgovaraju razmjeru dosadašnje panorame, ali mogu se slobodno promijeniti.
- **elements-preview.png**: pregled sadržaja. Šahovska podloga postoji samo na tom preglednom listu.

Ne crtati istodobno sprite i njegov odgovarajući puni layer jer su to dvije verzije istog elementa. Sunce i oblaci već imaju ugrađenu poluprozirnost; postaviti opacity na 1 pri crtanju.

U parallax sceni redoslijed prednjih zgrada, stabala i ograda odredite prema željenom preklapanju. Predložene brzine stabala/ograda su 0.64–0.70. Kuće i kafić uzmite iz ranije isporučenog paketa. Cesta je uključena kao zaseban sloj `layers/11-road.png` (2172 × 724) i obrezana traka `sprites/road.png` (2172 × 129). Traku postaviti na y=595; parallax 1.0. Sadrži nogostup, rub i cestu. Cesta/nogostup pokrivaju donji dio scene od približno y=595.

Ograde i živica su pojedinačni odjeljci s prozirnim rubom; nisu provjereni kao beskonačno ponovljive teksture.

## Stil i izvori

Stabla, ograde i živica rekonstruirani su ugrađenim **imagegen** alatom prema prvoj odobrenoj panorami. Dijelovi skriveni iza drugih objekata dopunjeni su, pa nisu identičan pikselni izrez. Stabla i živica zadržavaju maslinastozelene tonove originala.

Nebo, sunce, oblaci i daleki grad preuzeti su iz ranijeg paketa u dogovorenoj sivoj paleti. Izvorni SVG-ovi uključeni su radi precizne promjene boja:

- Nebo: #c7cbca → #aeb4b5 → #858c8e.
- Sunce: rgba(242,240,225,0.38).
- Oblaci: rgba(235,237,233,0.55).
- Daleki grad: #969c9e, parallax 0.16.
- Srednji grad: #737a7c, parallax 0.34.

Izvorne generirane slike i korišteni promptovi nalaze se u **source/**.
