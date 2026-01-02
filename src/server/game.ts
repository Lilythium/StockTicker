import Player from "./player.js";
import {
    DEFAULT_SETTINGS,
    MAX_PLAYERS,
    PAR_PRICE,
    GameId,
    GameState,
    GameStatus,
    GameSettings,
    PlayerId,
    PlayerState,
    Stock,
    StockPrices
} from "../interface/index.js";

export class Game {
    #id: GameId;
    #settings: GameSettings = DEFAULT_SETTINGS;
    #players = new Map<PlayerId, Player>();
    #host_id: PlayerId | undefined;
    #prices: StockPrices = {
        Gold: PAR_PRICE,
        Silver: PAR_PRICE,
        Oil: PAR_PRICE,
        Bonds: PAR_PRICE,
        Industrials: PAR_PRICE,
        Grain: PAR_PRICE
    } as StockPrices;
    #status: GameStatus = "waiting";

    constructor(id: GameId) {
        this.#id = id;
    }

    id(): GameId {
        return this.#id;
    }

    settings(): GameSettings {
        return this.#settings;
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

    /**
     * Game start request
     * @param player_id 
     * @returns if start request succeeded
     */
    start(player_id: PlayerId): boolean {
        if (this.#host_id !== player_id) {
            return false;
        }
        if (this.#status === "waiting") {
            this.#status = "active";
            return true;
        }
        return false;
    }

    stock_price(stock: Stock): number {
        return this.#prices[stock];
    }
    
    state(): GameState {
        let players: PlayerState[] = [];
        let active_player_count = 0;

        let i = 0;
        for (let [_, player] of this.#players) {
            players.push(player.state());
            if (player.connected()) {
                active_player_count++;
            }
            i++;
        }

        switch(this.#status) {
            case "waiting": return {
                status: "waiting",
                players,
                host_id: this.#host_id!
            };
            case "active": return {
                status: "active",
                players
            }
            case "finished": return {
                status: "finished"
            }
        }
    }
}