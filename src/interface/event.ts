import { PlayerId, Stock } from ".";

export type PlayerAction = {
    kind: "trade",
    stock: Stock,
    shares: number,
    direction: "buy" | "sell"
} | {
    kind: "roll"
};

export type PlayerEvent = {
    player: PlayerId,
    action: PlayerAction
};

export type History = {
    events: PlayerEvent[],
    net_worth: Record<PlayerId, number>[]
};