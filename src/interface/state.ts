import { PlayerId, Stock } from "./index.js";

/**
 * Player portfolio.
 * Share count should always be a multiple of 500.
 */
export type Portfolio = {[K in Stock]: number} & { readonly __brand: "Portfolio" };
export type StockPrices = {[K in Stock]: number} & { readonly __brand: "Portfolio" };

export type PlayerState = {
    id: PlayerId,
    name: string,
    cash: number,
    portfolio: Portfolio,
    is_connected: boolean,
    has_left: boolean
};

export type GameStatus = "waiting" | "active" | "finished";

export type GameState = {
    status: "waiting",
    players: PlayerState[],
    host_id: PlayerId
} | {
    status: "active",
    players: PlayerState[]
} | {
    status: "finished"
};