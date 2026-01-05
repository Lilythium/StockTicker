export * from "./event.js";
export * from "./state.js";

export const OFF_MARKET_PRICE: number = 0;
export const PAR_PRICE: number = 100;
export const SPLIT_PRICE: number = 200;
export const MAX_PLAYERS: number = 4;

export type Stock =
    "Gold"
    | "Silver"
    | "Oil"
    | "Bonds"
    | "Industrials"
    | "Grain";
export type PlayerToken = string & { readonly __brand: "PlayerToken" };
export type PlayerId = string & { readonly __brand: "PlayerId" };
export type GameId   = string & { readonly __brand: "GameId" };

export type GameSettings = {
    max_rounds: number,
    trading_duration: number,
    dice_duration: number,
    /** strating cash value in cents */
    starting_cash: number 
};

export const DEFAULT_SETTINGS: GameSettings = {
    max_rounds: 15,
    trading_duration: 2,
    dice_duration: 15,
    starting_cash: 5_000_00
};