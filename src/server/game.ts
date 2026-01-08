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

export class Game {
    #id: GameId;
    #status: GameStatus = "waiting";
    settings: GameSettings = DEFAULT_SETTINGS;
    #phase: GamePhase = "trading";
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
    #host_id: PlayerId | undefined;
    #event_history: GameEvent[] = [];

    constructor(id: GameId) {
        this.#id = id;
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

    all_players_done(): boolean {
        let all = true;
        for (const [_, player] of this.#players) {
            if (!player.is_done()) {
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
    process_action(player_id: PlayerId, action: PlayerAction): boolean {
        switch (action.kind) {
            case "trade": return this.process_trade(player_id, action);
            case "roll": return this.process_roll(player_id);
        }
    }

    process_trade(player_id: PlayerId, trade: TradePlayerAction): boolean {
        if (this.#phase !== "trading") return false;

        const player = this.#players.get(player_id);
        if (player == null) return false;

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

        if (succeeded) this.#event_history.push({
            kind: "trade",
            player: player_id,
            stock: trade.stock,
            direction: trade.direction,
            shares: trade.shares
        });
        return succeeded;
    }

    process_roll(player_id: PlayerId): boolean {
        if (this.#phase !== "dice") return false;

        let current_player!: Player;
        for (const [_, player] of this.#players) {
            if (!player.is_done()) {
                current_player = player;
                break;
            }
        }

        if (player_id !== current_player.id()) return false;

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

        current_player.set_done(true);

        const event: GameEvent = {
            kind: "roll",
            player: player_id,
            stock,
            movement,
            amount,
            success
        };

        this.#event_history.push(event);

        let all_done = true;
        for (const [_, player] of this.#players) {
            if (!player.is_done()) {
                all_done = false;
                break;
            }
        }

        if (all_done) {
            this.end_phase();
        }
        
        return true
    }

    end_phase() {
        switch (this.#phase) {
            case "trading":
                this.#phase = "dice";
                break;
            case "dice":
                this.#phase = "trading";
                this.#round += 1;
                break;
        }

        for (const [_, player] of this.#players) {
            player.set_done(false);
        }
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
                round: this.#round,
                players,
                prices: this.#prices,
                history: {
                    events: this.#event_history,
                    net_worth: []
                }
            }
            case "finished": return {
                status: "finished"
            }
        }
    }
}