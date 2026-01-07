import {html, LitElement} from 'lit';
import {customElement} from 'lit/decorators.js';
import { GAME_ID } from "../params.js";

@customElement("lobby-view")
export default class LobbyView extends LitElement {
    private game_id: string;

    constructor() {
        super();
        this.game_id = GAME_ID ?? this.random_id();
    }

    // use light dom
    protected createRenderRoot(): HTMLElement | DocumentFragment { return this; }

    random_id() {
        return Math.floor(Math.random() * 10000).toString().padStart(4, "0");
    }

    randomise() {
       this.game_id = this.random_id(); 
    }

    render() {
        return html`
            <div class="lobby-container">
                <div class="lobby-header">
                    <h1>Stock Ticker</h1>
                </div>

                <div class="lobby-option">
                    <h2>Player Registration</h2>
                    <form id="joinForm" action="/join" method="POST">
                        <div class="form-group">
                            <label for="player_name">Name</label>
                            <input type="text"
                                   name="player_name"
                                   placeholder="TYPE NAME HERE..."
                                   required
                                   maxlength="20"
                                   autofocus>
                        </div>

                        <div class="form-group">
                            <label for="game_id">Game ID</label>
                            <div class="input-wrapper">
                                <input type="text"
                                       name="game_id"
                                       .value="${this.game_id}"
                                       required
                                       maxlength="30">
                                <span
                                    class="input-icon"
                                    id="randomizeBtn"
                                    title="Roll for Random ID"
                                    @click=${this.randomise}
                                >🎲</span>
                            </div>
                        </div>

                        <button type="submit" class="btn-primary">
                            Join / Create Game
                        </button>
                    </form>
                </div>

                <div class="lobby-option">
                    <div class="info-box">
                        <h2>Rules</h2>
                        <ul>
                            <li><strong>2-4 Players</strong> compete for profit.</li>
                            <li>Start with <strong>$5,000</strong> cash on hand.</li>
                            <li>Trade in <strong>blocks of 500 shares</strong>.</li>
                            <li>Markets move based on <strong>dice rolls</strong>.</li>
                            <li><strong>Disconnected?</strong> You can rejoin anytime!</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }
}