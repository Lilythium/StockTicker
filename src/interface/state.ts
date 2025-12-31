import { Stock } from ".";

/**
 * Player portfolio.
 * Share count should always be a multiple of 500.
 */
export type Portfolio = {[K in Stock]: number} & { readonly __brand: "Portfolio" };
export type StockPrices = {[K in Stock]: number} & { readonly __brand: "Portfolio" };

export type PlayerState = {
    /** Player slot is empty */
    is_empty: true
} | {
    /** Player slot is occupied */
    is_empty: false,
    name: string,
    cash: number,
    portfolio: Portfolio,
    net_worth: number,
    done_trading: boolean,
    is_connected: boolean,
    has_left: boolean
};

export type GameStatus = "waiting" | "active" | "finished";

export type GameSettings = {

};

export type GameState = {
    status: "waiting",
    players: PlayerState[]
} | {
    status: "active",
    players: PlayerState[]
} | {
    status: "finished"
};