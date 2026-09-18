# Ispravak ZOOM_BACKGROUND u poslanom game.js

Obje dostavljene verzije imaju istu pogrešku u `draw()`. Vanjski `context.scale(ZOOM_BACKGROUND, ZOOM_BACKGROUND)` množi skalu s zoomom, dok `width: this.width / ZOOM_BACKGROUND` i `height: this.height / ZOOM_BACKGROUND` unutar postojećeg renderera dijele skalu zoomom. Budući da je `viewportWidth` ostao konstantan, zoom se potpuno poništi na obje osi:

```text
ukupna skala X = zoom × (viewWidth / zoom) / scene.canvas.width
               = viewWidth / scene.canvas.width
ukupna skala Y = zoom × (viewHeight / zoom) / scene.canvas.height
               = viewHeight / scene.canvas.height
preostali pomak Y = groundY × (1 − zoom)
```

Zato se elementi ne smanjuju, nego se scena pomiče gore/dolje. Uz to se koristi visina tla u ekranskim koordinatama kao da je visina tla izvornog projekta.

## Točna zamjena

U `draw()` zamijeni **samo sadržaj** postojeće grane `if (this.parallaxProject && globalThis.ParallaxRuntime) { ... }` sljedećim kodom. Ostatak metode, `else` fallback, igrača, fiziku, HUD i DPR transformaciju ostavi kako jesu. Zadrži konfiguracijsku varijablu `ZOOM_BACKGROUND`; za prvi pregled predlažem 0.75. Vrijednost 0.2 je također valjana, ali znači pet puta manje zgrade u odnosu na zoom 1.

```js
const scene = this.parallaxProject.scene;
const groundY = this.getGroundY();
const zoom = Number.isFinite(ZOOM_BACKGROUND) && ZOOM_BACKGROUND > 0
  ? ZOOM_BACKGROUND : 1;
const baseScale = this.height / scene.canvas.height;
const scale = baseScale * zoom;

context.save();
context.beginPath();
context.rect(0, 0, this.width, this.height);
context.clip();

// Podloge popunjavaju prostor koji zoom out otkriva izvan visine PNG-a.
// Nema dodatnog sunca ili oblaka: oni već mogu biti u izvezenim slojevima.
const sky = context.createLinearGradient(0, 0, 0, this.height);
sky.addColorStop(0, '#c7cbca');
sky.addColorStop(0.55, '#aeb4b5');
sky.addColorStop(1, '#858c8e');
context.fillStyle = sky;
context.fillRect(0, 0, this.width, this.height);
context.fillStyle = '#2f3436';
context.fillRect(0, groundY, this.width, this.height - groundY);

// Sidro je tlo iz projekta preslikano na tlo igre.
context.translate(0, groundY - scene.groundY * scale);
globalThis.ParallaxRuntime.render(
  context,
  scene,
  this.parallaxImages,
  this.worldX,
  {
    width: this.width,
    height: scene.canvas.height * scale,
    viewportWidth: this.width / scale,
    clear: false,
  },
);
context.restore();
```

Nemoj ostaviti stari `context.scale(...)`, par pomaka oko `groundY`, `expandedWidth` ili `expandedHeight`. Renderer sam primjenjuje konačnu skalu na obje osi. Širina kadra u pikselima scene sada raste pri odzumiranju pa renderer iscrtava dovoljno kopija petlje. Razmak kopija skalira se jednako kao slike; `scene.loop` i `layer.parallax` ostaju nepromijenjeni.

Jednolika osnovna skala temelji se na visini scene, kao u glavnim uputama. Time se ujedno uklanja prethodno nejednako rastezanje po X i Y ako format ekrana nije isti kao format scene. Vrijednosti zooma uspoređivati unutar ovog ispravljenog prikaza.

Provjera: pri istoj poziciji kamere izmjeri širinu i visinu jedne zgrade na zoomu 1, zatim 0.75, 0.5 i 0.2. Dimenzije trebaju biti točno 100%, 75%, 50% i 20% referentne veličine. Točka na `scene.groundY` mora u svim slučajevima završiti na `this.getGroundY()`. Igrač ostaje iste veličine. Provjeri i dovoljno kopija petlje za prošireni kadar. PNG sadržaj i njegova stvarna razina tla moraju odgovarati spremljenom `scene.groundY`.

Ova zamjena pretpostavlja izvorni `ParallaxRuntime.render` priložen projektu, koji računa `width / viewportWidth` i `height / scene.canvas.height`. Ako je i renderer naknadno mijenjan, treba pregledati i njegovu verziju.
