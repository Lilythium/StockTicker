import { PlayerId, Stock } from ".";

export type PlayerAction = {
    kind: "trade",
    stock: Stock,
    shares: number,
    direction: "buy" | "sell"
} | {
    kind: "roll"
};

export type TradePlayerAction = Extract<PlayerAction, { kind: "trade" }>;
export type RollPlayerAction = Extract<PlayerAction, { kind: "roll" }>;

export type StockMovement = "up" | "down" | "dividend";

export type GameEvent = {
    kind: "trade",
    player: PlayerId,
    stock: Stock,
    shares: number,
    direction: "buy" | "sell"
} | {
    kind: "roll",
    player: PlayerId,
    stock: Stock,
    movement: StockMovement,
    amount: number,
    success: boolean
};

export type TradeEvent = Extract<GameEvent, { kind: "trade" }>;
export type RollEvent = Extract<GameEvent, { kind: "roll" }>;

export type History = {
    events: GameEvent[],
    net_worth: Record<PlayerId, number>[]
};