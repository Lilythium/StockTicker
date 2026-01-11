import { BroadcastOperator } from "socket.io";
import { DecorateAcknowledgementsWithMultipleResponses, DefaultEventsMap } from "socket.io/dist/typed-events.js";
import Player from "./player.js";
import {
    DEFAULT_SETTINGS,
    MAX_PLAYERS,
    PAR_PRICE,
    GameId,
    GamePhase,
    GameState,
    GameStatus,
    GameSettings,
    PlayerId,
    PlayerState,
    Stock,
    StockPrices,
    PlayerAction,
    StockMovement,
    GameEvent,
    TradePlayerAction,
} from "../common/index.js";

type IO = BroadcastOperator<DecorateAcknowledgementsWithMultipleResponses<DefaultEventsMap>, any>

export class Game {
    #id: GameId;
    #io: IO;
    #status: GameStatus = "waiting";
    settings: GameSettings = DEFAULT_SETTINGS;
    #phase: GamePhase = { kind: "trading" };
    #phase_end?: Date;
    #phase_timeout?: NodeJS.Timeout;
    #round: number = 1;
    #prices: StockPrices = {
        Gold: PAR_PRICE,
        Silver: PAR_PRICE,
        Oil: PAR_PRICE,
        Bonds: PAR_PRICE,
        Industrials: PAR_PRICE,
        Grain: PAR_PRICE
    } as StockPrices;
    #players = new Map<PlayerId, Player>();
    #host_id?: PlayerId;
    #event_history: GameEvent[] = [];

    constructor(id: GameId, io: IO) {
        this.#id = id;
        this.#io = io;
    }

    id(): GameId {
        return this.#id;
    }

    status(): GameStatus {
        return this.#status;
    }

    /**
     * Fails if game is full
     * @param player_id 
     * @param player_name 
     * @returns 
     */
    add_player(player_id: PlayerId, player_name: string): Player | undefined {
        if (this.#players.size < MAX_PLAYERS) {
            if (this.#players.size === 0) {
                this.#host_id = player_id;
            }
            let player = new Player(player_id, this, player_name);
            this.#players.set(player_id, player);
            return player;
        }
    }

    is_host(player_id: PlayerId): boolean {
        return this.#host_id === player_id
    }

    stock_price(stock: Stock): number {
        return this.#prices[stock];
    }

    all_players_done_trading(): boolean {
        let all = true;
        for (const [_, player] of this.#players) {
            if (!player.is_done_trading()) {
                all = false;
                break;
            }
        }
        return all;
    }

    /**
     * Game start request
     * @param player_id 
     * @returns if start request succeeded
     */
    start(player_id: PlayerId): boolean {
        if (!this.is_host(player_id)) {
            return false;
        }
        if (this.#status === "waiting") {
            this.#status = "active";
            const trading_duration = this.settings.trading_duration * 60 * 1000;
            this.#phase_end = new Date(Date.now() + trading_duration);
            this.#phase_timeout = setTimeout(() => this.end_phase(), trading_duration);
            for (const [_, player] of this.#players) {
                player.start();
            }
            return true;
        }
        return false;
    }

    /**
     * Process player's action
     * @param action 
     * @param player_id
     * @returns if the action was processed
     */
    process_action(player_id: PlayerId, action: PlayerAction): GameEvent | null {
        switch (action.kind) {
            case "trade": return this.process_trade(player_id, action);
            case "roll": return this.process_roll(player_id);
        }
    }

    process_trade(player_id: PlayerId, trade: TradePlayerAction): GameEvent | null {
        if (this.#phase.kind !== "trading") return null;

        const player = this.#players.get(player_id);
        if (player == null) return null;

        let succeeded = false;
        switch (trade.direction) {
            case "buy":
                succeeded = player.buy(
                    trade.stock,
                    trade.shares,
                    this.#prices[trade.stock]
                );
                break;

            case "sell":
                succeeded = player.sell(
                    trade.stock,
                    trade.shares,
                    this.#prices[trade.stock]
                );
                break;
        }

        const event: GameEvent = {
            kind: "trade",
            player: player_id,
            stock: trade.stock,
            direction: trade.direction,
            shares: trade.shares
        };

        if (succeeded) this.#event_history.push(event);
        return event;
    }

    process_roll(player_id: PlayerId): GameEvent | null {
        if (this.#phase.kind !== "dice") return null;

        if (player_id !== this.#players.get(player_id)?.id()) return null;

        const stocks = Object.keys(this.#prices);
        const stock = stocks[Math.floor(Math.random() * stocks.length)] as Stock;

        const movements: StockMovement[] = ["up", "down", "dividend"];
        const movement = movements[Math.floor(Math.random() * movements.length)];

        const amounts = [5, 10, 20];
        const amount = amounts[Math.floor(Math.random() * amounts.length)];

        let success = true;
        switch (movement) {
            case "up":
                this.#prices[stock] += amount;
                break;
            case "down":
                this.#prices[stock] -= amount;
                break;
            case "dividend":
                if (this.#prices[stock] < PAR_PRICE) {
                    success = false;
                    break;
                }
                for (const [_, player] of this.#players) {
                    player.dividends(stock, amount);
                }
                break;                    
        }

        const event: GameEvent = {
            kind: "roll",
            player: player_id,
            stock,
            movement,
            amount,
            success
        };

        this.#event_history.push(event);

        this.end_phase();
        
        return event;
    }

    end_phase() {
        clearTimeout(this.#phase_timeout);
        this.#phase_timeout = undefined;
        switch (this.#phase.kind) {
            case "trading":
                this.#phase = {
                    kind: "dice",
                    index: 0
                };
                const dice_duration = this.settings.dice_duration * 1000;
                this.#phase_end = new Date(Date.now() + dice_duration);
                this.#phase_timeout = setTimeout(() => this.end_phase(), dice_duration);
                break;
            case "dice":
                if (this.#phase.index < this.#players.size - 1) {
                    this.#phase = {
                        kind: "dice",
                        index: this.#phase.index + 1
                    };
                    const dice_duration = this.settings.dice_duration * 1000;
                    this.#phase_end = new Date(Date.now() + dice_duration);
                    this.#phase_timeout = setTimeout(() => this.end_phase(), dice_duration);
                } else {
                    this.#phase = { kind: "trading" };
                    const trading_duration = this.settings.trading_duration * 60 * 1000;
                    this.#phase_end = new Date(Date.now() + trading_duration);
                    this.#phase_timeout = setTimeout(() => this.end_phase(), trading_duration);
                    this.#round += 1;
                    for (const [_, player] of this.#players) {
                        player.set_done_trading(false);
                    }
                }
                break;
        }

        this.post_update();
    }

    state(): GameState {
        const players: [PlayerId, PlayerState][] = [];
        for (const [id, player] of this.#players) {
            players.push([id as PlayerId, player.state()]);
        }

        switch(this.#status) {
            case "waiting": return {
                status: "waiting",
                players,
                host_id: this.#host_id!
            };
            case "active": return {
                status: "active",
                settings: this.settings,
                phase: this.#phase,
                phase_end: this.#phase_end!,
                round: this.#round,
                players,
                prices: this.#prices
            }
            case "finished": return {
                status: "finished"
            }
        }
    }

    post_update() {
        this.#io.emit("update", this.state());
    }
}