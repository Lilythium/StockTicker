import { io, Socket } from "socket.io-client";
import {
    GameStatus,
    GameState,
    PlayerAction,
    GameSettings
} from "../common/index.js";

export default class SocketClient {
    #io: Socket;
    #current_status: GameStatus;

    constructor(current_status: GameStatus, callback: (io: Socket) => void) {
        this.#io = io();
        this.#current_status = current_status;

        this.#io.on("update", (game_state: GameState) => this.#on_update(game_state));
        callback(this.#io);
    }

    start_game(settings: GameSettings) {
        this.#io.emit("start_game", settings);
    }

    submit_action(action: PlayerAction) {
        this.#io.emit("action", action);
    }

    trading_check(value: boolean) {
        this.#io.emit("trading_check", value);
    }

    dice_roll() {
        this.#io.emit("dice_roll");
    }

    #on_update(game_state: GameState) {
        console.log("🔄 update recieved", game_state);

        if (game_state.status != this.#current_status) {
            window.location.reload();
        }
    }
}