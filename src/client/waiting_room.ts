import { ORIGIN, GAME_ID } from "./params.js";

let game_link = document.getElementById("gameLink") as HTMLInputElement;
game_link.value = `${ORIGIN}/?game_id=${GAME_ID}`;

let copy_button = document.getElementById("copyButton") as HTMLButtonElement;
copy_button.addEventListener("click", () => {
    navigator.clipboard.writeText(game_link.value).then(() => {
        // TODO: put copy indicator here
    });
});