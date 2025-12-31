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
    #done_trading: boolean = false;
    #has_left: boolean = false;
    #is_connected: boolean = true;

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

    portfolio_evaluation(): number {
        let portfolio_value = 0;
        for (let stock of Object.keys(this.#portfolio)) {
            portfolio_value += this.#game.stock_price(stock as Stock) * this.#portfolio[stock as Stock] / 100;
        }
        return portfolio_value;
    }

    state(): PlayerState {
        return {
            is_empty: false,
            name: this.#name,
            cash: this.#cash,
            portfolio: this.#portfolio,
            net_worth: this.#cash + this.portfolio_evaluation(),
            done_trading: this.#done_trading,
            is_connected: this.#is_connected,
            has_left: this.#has_left,
        }
    }
}