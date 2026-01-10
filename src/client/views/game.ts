import {css, html, LitElement} from 'lit';
import {customElement, query, state} from 'lit/decorators.js';
import SocketClient from "../socket_client.js";
import {
    ActiveGameState,
    GameEvent,
    GameState,
    PlayerAction,
    PlayerId,
} from "../../common/index.js";
import { CURRENT_PLAYER_ID } from "../params.js";

import "../components/game-header.js";
import "../components/trade-controls/index.js";
import "../components/stock-chart.js";
import "../components/player-card.js";
import "../components/dice-overlay.js";
import DiceOverlay from '../components/dice-overlay.js';

@customElement("game-view")
export default class GameView extends LitElement {
    socket: SocketClient;

    @state()
    state: ActiveGameState | undefined

    @query("dice-overlay")
    dice_overlay!: DiceOverlay;

    constructor() {
        super();

        this.socket = new SocketClient("active", io => {
            io.on("update", (state: GameState) => {
                if (state.status != "active") return;
                this.state = state;
            });

            io.on("event", (event: GameEvent) => {
                if (event.kind == "roll") {
                    console.log(event);
                    this.dice_overlay.enqueue(event);
                }
            });
        });
    }

    // use light dom
    protected createRenderRoot(): HTMLElement | DocumentFragment { return this; }

    trade(e: CustomEvent<PlayerAction>) {
        this.socket.submit_action(e.detail);
    }

    done_trading(e: InputEvent) {
        const element = e.currentTarget as HTMLInputElement;
        this.socket.trading_check(element.checked);
    }

    roll() {
        this.socket.submit_action({ kind: "roll" });
    }

    render() {
        let player_turn_id: PlayerId | undefined;
        if (this.state) {
            for (const [id, player] of this.state.players) {
                if (!player.done_turn) {
                    player_turn_id = id;
                    break;
                }
            }
        }
        const is_my_turn = player_turn_id === CURRENT_PLAYER_ID;

        let roll_disabled = true;
        let roll_text = "⏳ Loading"        
        if(this.state?.phase === "dice") {
            if (is_my_turn) {
                roll_disabled = false;
                roll_text = '🎲 ROLL!';
            } else {
                roll_text = '⏳ Not Your Turn';
            }
        } else {
            roll_text = '⏳ Trading Phase';
        }

        return html`
            <game-header .state=${this.state}></game-header>

            <div class="action-form">
                <div class="form-row three-columns">
                    <div class="form-column column-roll">
                        <button
                            class="btn-roll-ready"
                            ?disabled=${roll_disabled}
                            @click=${this.roll}
                        >${roll_text}</button>
                    </div>

                    <div class="form-column column-trade">
                        <div class="trade-form">
                            <trade-controls
                                ?disabled=${this.state?.phase !== "trading"}
                                .prices=${this.state?.prices}
                                @trade=${this.trade}
                            ></trade-controls>
                        </div>
                    </div>

                    <div class="form-column column-done">
                        <div class="done-trading-section">
                            <div class="done-trading-control">
                                <div class="checkbox-header">
                                    <label>Done Trading?</label>
                                </div>
                                <div class="checkbox-wrapper">
                                    <input
                                        id="doneTradingCheckbox"
                                        type="checkbox"
                                        style="display:none;"
                                        ?disabled=${this.state?.phase !== "trading"}
                                        @change=${this.done_trading}
                                    >
                                    <label for="doneTradingCheckbox" class="checkbox-label">
                                        <div class="checkbox-box">
                                            <span class="checkmark">✓</span>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="stocks_display">
                <stock-chart .prices=${this.state?.prices}></stock-chart>
            </div>

            <div class="players">
                <div class="players-container" id="playersContainer">
                    ${
                        this.state
                        ? this.state.players.map(([id, state]) => html`
                            <player-card
                                .phase=${this.state?.phase ?? "trading"}
                                .player_id=${id}
                                .state=${state}
                                .prices=${this.state?.prices}
                            ></player-card> 
                        `)
                        : "Loading players..."
                    }
                </div>
            </div>

            <div class="history-bar" id="historyBar">
                <div class="history-header" onclick="window.currentGameView.toggleHistory()">
                    <span class="history-title">📜 Game History</span>
                    <span class="history-toggle" id="historyToggle">▼</span>
                </div>
                <div class="history-content" id="historyContent">
                    <div class="history-empty">Connecting...</div>
                </div>
            </div>

            <dice-overlay></dice-overlay>
        `;
    }
}