import { GAME_ID } from "./params.js";

const random_id = () => Math.floor(Math.random() * 10000).toString().padStart(4, "0");

let game_id_input = document.getElementById("game_id") as HTMLInputElement;
game_id_input.value = GAME_ID ?? random_id();

let randomise_button = document.getElementById("randomiseBtn")!;
randomise_button.addEventListener("click", () => game_id_input.value = random_id());