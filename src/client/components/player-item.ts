import {css, html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';

@customElement("player-item")
export default class PlayerItem extends LitElement {
    @property({type: Boolean})
    empty = false;

    @property()
    name = "Unknown";

    @property({type: Boolean})
    you = false;

    @property({type: Boolean})
    host = false;

    @property({type: Boolean})
    connected = false;

    static styles = css`
        .player-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            padding: 15px 20px;
            background: white;
            border: 2px solid var(--ink-black);
            font-family: var(--ticker-font);
        }

        .player-item.you { border: 3px solid var(--action-green); }
        .player-item.host { border-left: 15px solid var(--action-gold); }
        .player-name {
            font-family: var(--retro-font);
            font-weight: bold;
            font-size: 16px;
            text-transform: uppercase;
        }

        .player-badge {
            margin-left: 8px;
            padding: 2px 10px;
            font-size: 11px;
            text-transform: uppercase;
            border-radius: 15px;
            border: 1px solid var(--ink-black);
        }
        .player-badge.you { background: var(--action-green); color: white; }
        .player-badge.host { background: var(--action-gold); color: var(--ink-black); }
        .player-badge.disconnected { background: #e74c3c; color: white; font-weight: bold; }

        .empty-slot {
            margin-bottom: 10px;
            padding: 15px;
            background: rgba(0,0,0,0.05);
            border: 2px dashed #bdc3c7;
            text-align: center;
            color: #95a5a6;
            font-family: var(--ticker-font);
        }
    `;

    render() {
        if (this.empty) {
            return html`<div class="empty-slot">Waiting for player...</div>`;
        }

        return html`
            <div class="player-item ${this.you ? 'you' : ''} ${this.host ? 'host' : ''}">
                <div class="player-name">
                    ${this.name}
                    ${this.you ? html`<span class="player-badge you">You</span>` : html``}
                    ${this.host ? html`<span class="player-badge host">Host</span>` : ``}
                    ${!this.connected ? html`<span class="player-badge disconnected">OFFLINE</span>` : ``}
                </div>
                <div class="player-status">${!this.connected ? '⌛ Wait' : 'Ready ✅'}</div>
            </div>
        `;
    }
}