import { GameSettings, History, PlayerId, Stock } from "./index.js";

/**
 * Player portfolio.
 * Share count should always be a multiple of 500.
 */
export type Portfolio = {[K in Stock]: number} & { readonly __brand: "Portfolio" };
export type StockPrices = {[K in Stock]: number} & { readonly __brand: "Portfolio" };

export type PlayerState = {
    name: string,
    /** Player cash in cents */
    cash: number,
    portfolio: Portfolio,
    is_connected: boolean,
    has_left: boolean
};

export type GameStatus = "waiting" | "active" | "finished";
export type GamePhase = "trading" | "dice";

export type GameState = {
    status: "waiting",
    players: Record<PlayerId, PlayerState>,
    host_id: PlayerId
} | {
    status: "active",
    settings: GameSettings, // TODO: Pass settings to client separately?
    phase: GamePhase,
    round: number,
    players: Record<PlayerId, PlayerState>,
    prices: StockPrices,
    history: History // TODO: Pass history to client separately?
} | {
    status: "finished"
};

export type WaitingGameState = Extract<GameState, { status: "waiting" }>;
export type ActiveGameState = Extract<GameState, { status: "active" }>;
export type FinishedGameState = Extract<GameState, { status: "finished" }>;