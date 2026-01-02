import {
    GameStatus,
    GameState
} from "../interface/index.js";
import { GAME_ID } from "./params.js";

declare const io: (...args: any[]) => any;

export default class SocketClient {
    #io: any;
    #current_status: GameStatus;

    constructor(current_status: GameStatus, callback: (io: any) => void) {
        this.#io = io();
        this.#current_status = current_status;

        this.#io.on("update", (game_state: GameState) => this.#on_update(game_state));
        callback(this.#io);
    }

    start_game() {
        this.#io.emit("start_game");
    }

    #on_update(game_state: GameState) {
        console.log("🔄 update recieved", game_state);

        if (game_state.status != this.#current_status) {
            window.location.reload();
        }
    }
}