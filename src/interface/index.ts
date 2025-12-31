export * from "./messages.js";
export * from "./state.js";

export type Stock =
    "Gold"
    | "Silver"
    | "Oil"
    | "Bonds"
    | "Industrials"
    | "Grain";
export type PlayerId = string & { readonly __brand: "PlayerId" };
export type GameId   = string & { readonly __brand: "GameId" };