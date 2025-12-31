import {
    PAR_PRICE,
    MAX_PLAYERS
} from "./consts.js";
import Player from "./player.js";
import {
    GameId,
    GameSettings,
    GameState,
    GameStatus,
    PlayerId,
    PlayerState,
    Stock,
    StockPrices
} from "../interface/index.js";

export class Game {
    #id: GameId;
    #settings: GameSettings = {};
    #max_players: number = MAX_PLAYERS;
    #players = new Map<PlayerId, Player>();
    #host_player_index: number | null = null;
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

    add_player(player_name: string): Player | undefined {
        let player_id = crypto.randomUUID() as PlayerId;
        if (this.#players.size < this.#max_players) {
            if (this.#players.size === 0) {
                this.#host_player_index = this.#players.size;
            }
            let player = new Player(player_id, this, player_name);
            this.#players.set(player_id, player);
            return player;
        }
    }

    start(player_id: PlayerId): boolean {
        if ([...this.#players.keys()][this.#host_player_index!] !== player_id) {
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

        for (let [_, player] of this.#players) {
            players.push(player.state());
            if (player.connected()) {
                active_player_count++;
            }
        }

        for (let i = players.length; i < MAX_PLAYERS; i++) {
            players.push({ is_empty: true });
        }

        switch(this.#status) {
            case "waiting": return {
                status: "waiting",
                players
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