import { ORIGIN, GAME_ID, CURRENT_PLAYER_ID } from "../params.js";
import {
    DEFAULT_SETTINGS,
    GameSettings,
    GameState,
    MAX_PLAYERS,
    PlayerId,
    WaitingGameState
} from "../../interface/index.js";
import SocketClient from "../socket_client.js";

const settings: GameSettings = DEFAULT_SETTINGS;
const game_link = document.getElementById("gameLink") as HTMLInputElement;
const copy_button = document.getElementById("copyButton") as HTMLButtonElement;
const player_list = document.getElementById("playerList") as HTMLDivElement;
const start_game_button = document.getElementById("startGameBtn") as HTMLButtonElement;
const socket_client = new SocketClient("waiting", io => {
    io.on("update", (game_state: GameState) => {
        // Collapse GameState to WaitingGameState
        if (game_state.status != "waiting") return;
        update_players(game_state);
    });
});

game_link.value = `${ORIGIN}/?game_id=${GAME_ID}`;

copy_button.addEventListener("click", () => {
    navigator.clipboard.writeText(game_link.value).then(() => {
        copy_button.textContent = 'Copied!';
        copy_button.style.background = '#27ae60';
        
        setTimeout(() => {
            copy_button.textContent = 'Copy';
            copy_button.style.background = '';
        }, 2000);
    });
});

start_game_button.addEventListener("click", () => {
    socket_client.start_game();
});

(document.getElementById('range_max_rounds') as HTMLInputElement).addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    settings.max_rounds = parseInt(target.value);
    document.getElementById('val_rounds')!.textContent = target.value;
});

(document.getElementById('range_trading_duration') as HTMLInputElement).addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    settings.trading_duration = parseInt(target.value);
    document.getElementById('val_trading')!.textContent = target.value;
});

(document.getElementById('range_dice_duration') as HTMLInputElement).addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    settings.dice_duration = parseInt(target.value);
    document.getElementById('val_dice')!.textContent = target.value;
});

(document.getElementById('range_starting_cash') as HTMLInputElement).addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    settings.starting_cash = parseInt(target.value);
    document.getElementById('val_cash')!.textContent = '$' + parseInt(target.value).toLocaleString();
});

function update_players(game_state: WaitingGameState) {
    let active_players = 0;
    let html = "";
    let i = 0;

    const players = game_state.players;
    for (i; i < players.length; i++) {
        const [id, state] = players[i];
        if (state.is_connected) active_players++;

        const is_host = id === game_state.host_id;
        const is_you = id === CURRENT_PLAYER_ID;

        html += `
            <div class="player-item ${is_you ? 'you' : ''} ${is_host ? 'host' : ''}">
                <div class="player-name">
                    ${state.name}
                    ${is_you ? '<span class="player-badge you">You</span>' : ''}
                    ${is_host ? '<span class="player-badge host">Host</span>' : ''}
                    ${!state.is_connected ? '<span class="player-badge disconnected">OFFLINE</span>' : ''}
                </div>
                <div class="player-status">${!state.is_connected ? '⌛ Wait' : 'Ready ✅'}</div>
            </div>
        `;
    }

    for(i; i < MAX_PLAYERS; i++) {
        html += '<div class="empty-slot">Waiting for player...</div>';
    }

    player_list.innerHTML = html;
    const can_start = active_players >= 2;
    start_game_button.disabled = !can_start;
    start_game_button.textContent = can_start ? 'Start Game' : '⛔ Need 2+ Players';
}