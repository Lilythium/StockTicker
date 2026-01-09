import {css, html, LitElement} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import { ActiveGameState, PlayerId } from "../../common/index.js";
import { CURRENT_PLAYER_ID, GAME_ID } from "../params.js";

@customElement("game-header")
export default class GameHeader extends LitElement {
    @property()
    state: ActiveGameState | undefined;

    // use light dom
    protected createRenderRoot(): HTMLElement | DocumentFragment { return this; }

    render() {
        const name = (new Map(this.state?.players)).get(CURRENT_PLAYER_ID as PlayerId)?.name;

        let done_trading_count = 0;
        let online_count = 0;
        if(this.state) {
            for (const [_, player] of this.state.players) {
                if (player.done_turn) done_trading_count++;
                if (player.is_connected) online_count++;
            }
        }

        let player_turn_id: PlayerId | undefined;
        if(this.state) {
            for (const [id, player] of this.state.players) {
                if (!player.done_turn) {
                    player_turn_id = id;
                    break;
                }
            }
        }
        const is_my_turn = player_turn_id === CURRENT_PLAYER_ID;

        return html`
            <div class="game-header">
                <div class="header-unified-bar">
                    <div class="header-section identity">
                        <span class="game-id">ID: ${GAME_ID}</span>
                        <span class="player-name-display">${name}</span>
                    </div>

                    <div class="header-section phase-logic">
                        <span class="phase-label ${this.state?.phase ?? ""}">
                            ${this.state?.phase === 'dice' ? '🎲 DICE' :'🔄 TRADING'}
                        </span>
                        <div class="timer" id="timer">--:--</div>
                        <div
                            class="players-status"
                            ?hidden=${this.state?.phase !== "trading"}
                        >${done_trading_count}/${online_count} Ready</div>
                        <div
                            class="turn-status"
                            ?hidden=${this.state?.phase !== "dice"}
                        >
                            ${is_my_turn ? '<span class="your-turn-pulse">YOUR TURN</span>' : 'WAITING...'}
                        </div>
                    </div>

                    <div class="header-section progress-exit">
                        <span class="round-display">
                            Round ${this.state?.round || 1}/${this.state?.settings.max_rounds || 15}
                        </span>
                        <button id="leaveBtn" class="btn-leave">LEAVE</button>
                    </div>
                </div>
            </div>
        `;
    }
}