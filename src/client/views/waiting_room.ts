import { CURRENT_PLAYER_ID } from "../params.js";
import {
    GameState,
    MAX_PLAYERS,
    WaitingGameState
} from "../../interface/index.js";
import SocketClient from "../socket_client.js";

import "../components/share-link.js";
import "../components/player-item.js";
import "../components/host-sidebar.js";
import PlayerItem from "../components/player-item.js";
import HostSidebar from "../components/host-sidebar.js";

const player_list = document.getElementById("playerList") as HTMLDivElement;
const start_game_button = document.getElementById("startGameBtn") as HTMLButtonElement;
const player_count = document.getElementById("playerCount") as HTMLSpanElement;
const socket_client = new SocketClient("waiting", io => {
    io.on("update", (game_state: GameState) => {
        // Collapse GameState to WaitingGameState
        if (game_state.status != "waiting") return;
        update_players(game_state);
    });
});

start_game_button.addEventListener("click", () => {
    const host_sidebar = document.getElementById("hostSidebarComponent") as HostSidebar;
    socket_client.start_game(host_sidebar.settings);
});

function update_players(game_state: WaitingGameState) {
    player_count.innerText = `${game_state.players.length}/${MAX_PLAYERS}`;
    
    const players = game_state.players;
    player_list.innerHTML = ``;
    let active_players = 0;
    let i = 0;

    for (i; i < players.length; i++) {
        const [id, state] = players[i];
        if (state.is_connected) active_players++;

        const item = document.createElement("player-item") as PlayerItem;
        item.name = state.name;
        item.you = id === CURRENT_PLAYER_ID;
        item.host = id === game_state.host_id;
        item.connected = state.is_connected;
        player_list.appendChild(item);
    }

    for(i; i < MAX_PLAYERS; i++) {
        const item = document.createElement("player-item") as PlayerItem;
        item.empty = true;
        player_list.appendChild(item);
    }

    const can_start = active_players >= 2;
    start_game_button.disabled = !can_start;
    start_game_button.textContent = can_start ? 'Start Game' : '⛔ Need 2+ Players';
}