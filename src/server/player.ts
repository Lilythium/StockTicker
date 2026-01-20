import { Game } from "./game.js";
import { PlayerAssets, PlayerId, PlayerState, Portfolio, Stock } from "../common/index.js";

export default class Player {
    #id: PlayerId;
    #game: Game;
    #name: string;
    /** Player's cash in cents */
    #cash: number;
    #portfolio: Portfolio = {
        Gold: 0,
        Silver: 0,
        Oil: 0,
        Bonds: 0,
        Industrials: 0,
        Grain: 0
    } as Portfolio;
    #asset_history: PlayerAssets[] = [];
    #has_left: boolean = false;
    #is_connected: boolean = false;
    #done_trading: boolean = false;

    constructor(id: PlayerId, game: Game, name: string) {
        this.#id = id;
        this.#game = game;
        this.#name = name;
        this.#cash = game.settings.starting_cash;
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

    start() {
        this.#cash = this.#game.settings.starting_cash;
        this.end_round(); // track round "0"
    }

    is_done_trading(): boolean {
        return this.#done_trading;
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

    /**
     * Buy stocks
     * @param stock 
     * @param amount 
     * @param price 
     * @returns whether the trade succeeded
     */
    buy(stock: Stock, amount: number, price: number) {
        const value = amount * price;
        if (this.#cash < value) return false;
        this.#portfolio[stock] += amount;
        this.#cash -= value;
        return true;
    }

    /**
     * Sell stocks
     * @param stock 
     * @param amount 
     * @param price whether the trade succeeded
     */
    sell(stock: Stock, amount: number, price: number): boolean {
        const value = amount * price;
        if (this.#portfolio[stock] < amount) return false;
        this.#cash += value;
        this.#portfolio[stock] -= amount;
        return true;
    }

    /**
     * Collect dividends
     * @param stock 
     * @param amount 
     */
    dividends(stock: Stock, amount: number) {
        this.#cash += this.#portfolio[stock] * amount;
    }

    toggle_done_trading() {
        this.#done_trading = !this.#done_trading;
    }

    set_done_trading(value: boolean) {
        this.#done_trading = value;
    }

    end_round() {
        this.#asset_history.push({
            cash: this.#cash,
            portfolio: { ...this.#portfolio } // shallow copy
        });
        this.#done_trading = false;
    }

    state(): PlayerState {
        return {
            name: this.#name,
            assets: {
                cash: this.#cash,
                portfolio: this.#portfolio,
            },
            asset_history: this.#asset_history,
            is_connected: this.#is_connected,
            has_left: this.#has_left,
            done_trading: this.#done_trading
        };
    }
}