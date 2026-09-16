export class GameUI {
  constructor() {
    this.startScreen = document.querySelector("#start-screen");
    this.gameOverScreen = document.querySelector("#game-over-screen");
    this.hud = document.querySelector("#hud");
    this.touchPrompt = document.querySelector("#touch-prompt");

    this.scoreValue = document.querySelector("#score-value");
    this.beerValue = document.querySelector("#beer-value");
    this.distanceValue = document.querySelector("#distance-value");
    this.finalScore = document.querySelector("#final-score");
    this.finalDistance = document.querySelector("#final-distance");
    this.finalBeers = document.querySelector("#final-beers");
  }

  bindActions(onPlay, onReplay) {
    document.querySelector("#play-button").addEventListener("click", onPlay);
    document.querySelector("#replay-button").addEventListener("click", onReplay);
  }

  showStart() {
    this.startScreen.hidden = false;
    this.gameOverScreen.hidden = true;
    this.hud.hidden = true;
    this.touchPrompt.hidden = true;
  }

  showPlaying() {
    this.startScreen.hidden = true;
    this.gameOverScreen.hidden = true;
    this.hud.hidden = false;
    this.touchPrompt.hidden = false;
    window.setTimeout(() => {
      this.touchPrompt.hidden = true;
    }, 2200);
  }

  showGameOver({ score, distance, beers }) {
    this.hud.hidden = true;
    this.touchPrompt.hidden = true;
    this.gameOverScreen.hidden = false;
    this.finalScore.textContent = score.toLocaleString("hr-HR");
    this.finalDistance.textContent = `${Math.floor(distance)} m`;
    this.finalBeers.textContent = beers.toString();
    document.querySelector("#replay-button").focus({ preventScroll: true });
  }

  update({ score, distance, beers }) {
    this.scoreValue.textContent = score.toLocaleString("hr-HR");
    this.distanceValue.textContent = `${Math.floor(distance)} m`;
    this.beerValue.textContent = beers.toString();
  }
}
