import { Game } from "./game.js";
import { InputController } from "./input.js";
import { GameUI } from "./ui.js";

const canvas = document.querySelector("#game-canvas");
const input = new InputController(canvas);
const ui = new GameUI();
const game = new Game(canvas, input, ui);

ui.bindActions(
  () => game.start(),
  () => game.start(),
);
