import { Server, Socket } from "socket.io";
import { Game } from "./game";
import Player from "./player";
import {
    GameId,
    JoinGameMessage
} from "../interface";

class ClientManager {
    #players = new Map<string, Player>();

    set(socket_id: string, player: Player) {
        this.#players.set(socket_id, player);
    }

    get_player(socket_id: string): Player | undefined {
        return this.#players.get(socket_id);
    }

    remove_socket(socket_id: string) {
        this.#players.delete(socket_id);
    }
}

let io: Server;
export const clients = new ClientManager();
const games = new Map<GameId, Game>();

export default function init(server: any) {
    io = new Server(server);
    io.on("connection", player_connect);
}

function player_connect(socket: Socket) {
    console.log(`✅ Client connected: ${socket.id}`);
    socket.on("disconnect", () => player_disconnect(socket))
    socket.on("join_game", message => join_game(socket, message));
    socket.on("leave_game", () => leave_game(socket));
    socket.on("get_state", () => get_state(socket));
    socket.on("start_game", () => start_game(socket));
}

function player_disconnect(socket: Socket) {
    console.log(`❌ Client disconnected: ${socket.id}`);
    let player = clients.get_player(socket.id);
    if (!player) return;
    
    console.log(`❌ Player disconnected: ${player.name()} @ ${player.game().id()}`);
    player.set_connected(false);
    clients.remove_socket(socket.id);
    let game = player.game();
    io.to(game.id()).emit("game_state_update", game.state());
}

function join_game(socket: Socket, {
    game_id,
    player_id,
    player_name,
    player_count
}: JoinGameMessage) {
    console.log(`📥 Joining game: ${player_name} @ ${game_id}`);

    let game = games.get(game_id);
    if(!game) {
        console.log(`Creating new game: ${game_id}`);
        game = new Game(game_id, player_count);
        games.set(game_id, game);
    }

    let player = game.add_player(player_id, player_name);
    if(!player) {
        socket.emit("join_result", {
            success: false,
            error: "Player initialisation failed"
        });
        return;
    }

    clients.set(socket.id, player);
    socket.join(game_id);
    socket.emit("join_result", {
        success: true,
        game_state: game.state()
    });
    io.to(game_id).emit("game_state_update", game.state());
}

function leave_game(socket: Socket) {
    let player = clients.get_player(socket.id);
    if(!player) return;

    let game = player.game();
    let game_id = game.id();
    console.log(`🚪 Leave request: ${player.name()} @ ${game_id}`);
    player.leave();
    socket.leave(game_id);
    io.to(game_id).emit("game_state_update", game.state());
}

function get_state(socket: Socket) {
    console.log("retarded");
    let player = clients.get_player(socket.id);
    if(!player) return;

    let game = player.game();
    socket.emit("game_state_update", game.state());
}

function start_game(socket: Socket) {
    let player = clients.get_player(socket.id);
    if(!player) return;

    let game = player.game();
    let game_id = game.id();
    console.log(`🎮 Start game request: ${game_id}`);

    if(game.start(player.id())) {
        io.to(game_id).emit("game_started", { success: true });
        io.to(game_id).emit("game_state_update", game.state());
    }
}