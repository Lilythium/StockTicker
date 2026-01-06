import http from "http";
import cookie_parser from "cookie";
import { Server, Socket } from "socket.io";
import { Game } from "./game.js";
import Player from "./player.js";
import {
    GameId,
    GameSettings,
    PlayerAction,
    PlayerId,
    PlayerToken
} from "../interface/index.js";

export default class GameManager {
    #io: Server;
    #players = new Map<PlayerToken, Player>();
    #games = new Map<GameId, Game>();

    constructor(http_server: http.Server) {
        this.#io = new Server(http_server);
        this.#io.on("connection", socket => this.#on_connection(socket));
    }

    get_or_create_game(game_id: GameId): Game {
        let game = this.#games.get(game_id);
        if (game == null) {
            game = new Game(game_id);
            this.#games.set(game_id, game);
        }
        return game;
    }

    /**
     * Fails if the generated payer id is already used or if the game is full
     * @param game_id 
     * @param player_name 
     * @returns 
     */
    add_player(game_id: GameId, player_name: string): [PlayerToken, Player] | undefined {
        let game = this.#games.get(game_id);
        if (game == null) return;

        let player_id = crypto.randomUUID() as PlayerId;
        let player_token = crypto.randomUUID() as PlayerToken;
        if (this.#players.get(player_token) != null) return;

        let player = game.add_player(player_id, player_name);
        if (player == null) return;
       
        this.#players.set(player_token, player);
        return [player_token, player];
    }

    get_player(player_token: PlayerToken): Player | undefined {
        return this.#players.get(player_token);
    }

    remove_player(player_token: PlayerToken) {
        this.#players.delete(player_token);
    }

    /**
     * Post the current game state as a socket "update" event.
     * @param game_id
     * @returns 
     */
    post_game_update(game_id: GameId) {
        const game = this.#games.get(game_id);
        if (game == null) return;
        this.#io.to(game_id).emit("update", game.state());
    }

    #on_connection(socket: Socket) {
        console.log(`🔌 Socket connected: ${socket.id}`);
    
        let player: Player | undefined;
        let cookie = socket.request.headers.cookie;
        if (cookie != null) {
            let { player_token } = cookie_parser.parseCookie(cookie);
            player = this.get_player(player_token as PlayerToken);
            socket.data.player_token = player_token;
        }
        if (player == null) {
            console.log(`❌ Socket rejected: ${socket.id}`);
            socket.disconnect();
            return;
        }

        console.log(`✅ Player authenticated: ${player?.name()}`);
        player.set_connected(true);
        const game = player.game();

        socket.join(game.id());
        socket.on("disconnect", () => this.#on_disconnect(socket));
        socket.on("start_game", settings => this.#on_start_game(socket, settings));
        socket.on("action", action => this.#on_action(socket, action));
        socket.on("trading_check", value => this.#on_trading_check(socket, value));

        this.post_game_update(game.id());
    }

    #on_disconnect(socket: Socket) {
        console.log(`🔌 Socket disconnected: ${socket.id}`);
        const player_token = socket.data.player_token as PlayerToken;
        const player = this.get_player(player_token);
        if (player === undefined) return;
       
        console.log(`❌ Player disconnected: ${player.name()}`);
        player.set_connected(false);
        this.post_game_update(player.game().id());
    }

    #on_start_game(socket: Socket, settings: GameSettings) {
        const player_token = socket.data.player_token as PlayerToken;
        const player = this.get_player(player_token);
        if (player === undefined) return;

        const game = player.game();
        game.settings = settings;
        if(!game.start(player.id())) return;
        console.log(`🕹️ Game '${game.id()}' started`)
        this.post_game_update(game.id());
    }

    #on_action(socket: Socket, action: PlayerAction) {
        const player_token = socket.data.player_token as PlayerToken;
        const player = this.get_player(player_token);
        if (player === undefined) return;

        console.log(`📨 Player action submitted: ${player.name()}, ${action.kind}`);
        const game = player.game();
        const processed = game.process_action(action, player.id());
        if (!processed) return;
        this.post_game_update(game.id());
    }

    #on_trading_check(socket: Socket, value: boolean) {
        const player_token = socket.data.player_token as PlayerToken;
        const player = this.get_player(player_token);
        if (player === undefined) return;

        console.log(`✅ Player trading checked: ${player.name()}`);
        player.set_done(value);
        const game = player.game();
        if (game.all_players_done()) game.end_phase();
        this.post_game_update(game.id());
    }
}