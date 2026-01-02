import { Game } from "./game.js";
import { PlayerId, PlayerState, Portfolio, Stock } from "../interface//index.js";

export default class Player {
    #id: PlayerId;
    #game: Game;
    #name: string;
    #cash: number = 0;
    #portfolio: Portfolio = {
        Gold: 0,
        Silver: 0,
        Oil: 0,
        Bonds: 0,
        Industrials: 0,
        Grain: 0
    } as Portfolio;
    #has_left: boolean = false;
    #is_connected: boolean = false;

    constructor(id: PlayerId, game: Game, name: string) {
        this.#id = id;
        this.#game = game;
        this.#name = name;
    }

    id(): PlayerId {
        return this.#id;
    }

    game(): Game {
        return this.#game;
    }

    name(): string {
        return this.#name;
    }

    connected(): boolean {
        return this.#is_connected;
    }

    set_connected(is_connect: boolean) {
        this.#is_connected = is_connect;
    }

    leave() {
        this.#has_left = true;
    }

    set_cash(cash: number): void {
        this.#cash = cash;
    }

    state(): PlayerState {
        return {
            id: this.#id,
            name: this.#name,
            cash: this.#cash,
            portfolio: this.#portfolio,
            is_connected: this.#is_connected,
            has_left: this.#has_left,
        }
    }
}