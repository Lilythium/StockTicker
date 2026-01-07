import { ActiveGameState, PlayerId } from "../../interface/index.js";
import { CURRENT_PLAYER_ID, GAME_ID } from "../params.js";

export default class GameHeader extends HTMLElement {
    #name: string | undefined;

    constructor() {
        super()
    }

    update(state: ActiveGameState) {
        const phase_label = document.querySelector('.phase-label');
        if (phase_label) {
            phase_label.className = `phase-label ${state.phase}`;
            phase_label.textContent = state.phase === 'trading' ? '🔄 TRADING' : '🎲 DICE';
        }

        const player_status = document.querySelector('.players-status') as HTMLDivElement;
        let done_trading_count = 0;
        let online_count = 0;
        for (const [_, player] of state.players) {
            if (player.done_turn) done_trading_count++;
            if (player.is_connected) online_count++;
        }
        if (state.phase === 'trading') {
            player_status.textContent = `${done_trading_count}/${online_count} Ready`;
            player_status.style.display = '';
        } else {
            player_status.style.display = 'none';
        }

        let player_turn_id: PlayerId | undefined;
        for (const [id, player] of state.players) {
            if (!player.done_turn) {
                player_turn_id = id;
                break;
            }
        }
        const is_my_turn = player_turn_id === CURRENT_PLAYER_ID;

        const turn_status = document.querySelector('.turn-status') as HTMLDivElement;
        if (state.phase === 'dice') {
            turn_status.innerHTML = is_my_turn ? '<span class="your-turn-pulse">YOUR TURN</span>' : 'WAITING...';
            turn_status.style.display = '';
        } else {
            turn_status.style.display = 'none';
        }

        const round_display = document.querySelector('.round-display');
        if (round_display) {
            round_display.textContent = `Round ${state.round || 1}/${state.settings.max_rounds || 15}`;
        }
    }

    connectedCallback() {
        this.render();
    }

    private render() {
        this.innerHTML = `
            <div class="game-header">
                <div class="header-unified-bar">
                    <div class="header-section identity">
                        <span class="game-id">ID: ${GAME_ID}</span>
                        <span class="player-name-display">${this.#name}</span>
                    </div>

                    <div class="header-section phase-logic">
                        <span class="phase-label trading">🔄 LOADING...</span>
                        <div class="timer" id="timer">--:--</div>
                        <div class="players-status">0/0</div>
                        <div class="turn-status" style="display:none;">WAITING...</div>
                    </div>

                    <div class="header-section progress-exit">
                        <span class="round-display">Round 1/1</span>
                        <button id="leaveBtn" class="btn-leave">LEAVE</button>
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define("game-header", GameHeader);