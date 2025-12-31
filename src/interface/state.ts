import { PlayerId, Stock } from ".";

/**
 * Player portfolio.
 * Share count should always be a multiple of 500.
 */
export type Portfolio = {[K in Stock]: number} & { readonly __brand: "Portfolio" };
export type StockPrices = {[K in Stock]: number} & { readonly __brand: "Portfolio" };

export type PlayerState = {
    /** Player slot is empty */
    is_active: false
} | {
    /** Player slot is occupied */
    is_active: true
    player_id: PlayerId,
    name: string,
    cash: number,
    portfolio: Portfolio,
    net_worth: number,
    done_trading: boolean,
    is_connected: boolean,
    has_left: boolean
};

export type GameStatus = "waiting" | "active" | "finished";

export type GameState = {
    status: GameStatus,
    game_over: boolean,
    player_count: number,
    players: PlayerState[],
    host_player_id: PlayerId,
    connected_player_count: number,
    active_player_count: number,
    stocks: StockPrices
};