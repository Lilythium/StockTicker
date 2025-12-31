import {
    PAR_PRICE,
    MAX_PLAYERS
} from "./consts";
import Player from "./player";
import {
    GameId,
    GameState,
    GameStatus,
    PlayerId,
    PlayerState,
    Stock,
    StockPrices
} from "../interface";

export class Game {
    #id: GameId;
    #max_players: number;
    #players = new Map<PlayerId, Player>();
    #host_player_id: PlayerId | null = null;
    #config = null;
    #prices: StockPrices = {
        Gold: PAR_PRICE,
        Silver: PAR_PRICE,
        Oil: PAR_PRICE,
        Bonds: PAR_PRICE,
        Industrials: PAR_PRICE,
        Grain: PAR_PRICE
    } as StockPrices;
    #status: GameStatus = "waiting";

    constructor(id: GameId, max_players: number) {
        this.#id = id;
        this.#max_players = max_players;
    }

    id(): GameId {
        return this.#id;
    }

    add_player(player_id: PlayerId, player_name: string): Player | undefined {
        if (this.#players.size < this.#max_players) {
            if (this.#players.size === 0) {
                this.#host_player_id = player_id;
            }
            let player = new Player(player_id, this, player_name);
            this.#players.set(player_id, player);
            return player;
        }
    }

    start(player_id: PlayerId): boolean {
        if (this.#host_player_id !== player_id) {
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
        let connected_player_count = 0;

        for (let [_, player] of this.#players) {
            players.push(player.state());
            if (player.connected()) {
                connected_player_count++;
            }
        }

        for (let i = players.length; i < MAX_PLAYERS; i++) {
            players.push({ is_active: false });
        }

        return {
            status: this.#status,
            game_over: false,
            player_count: 4,
            players,
            host_player_id: this.#host_player_id!,
            connected_player_count,
            active_player_count: connected_player_count,
            stocks: this.#prices
        };
    }
}