import {css, html, LitElement} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import { ORIGIN, GAME_ID } from "../params.js";

@customElement("share-link")
export default class ShareLink extends LitElement {
    static styles = css`
        #container {
            margin: 15px 0;
        }
        
        .copy-link {
            display: flex;
        }
        
        .copy-link input {
            flex: 1;
            padding: 12px;
            background: white;
            border: var(--border-thick);
            font-family: var(--ticker-font);
            font-weight: bold;
        }

        .copy-link button {
            padding: 0 25px;
            background: var(--action-blue);
            color: white;
            border: var(--border-thick);
            border-left: none;
            font-family: var(--retro-font);
            font-weight: bold;
            text-transform: uppercase;
            cursor: pointer;
        }
    `;

    @state()
    private copied: boolean = false;

    private url = `${ORIGIN}/?game_id=${GAME_ID}`;

    render() {
        return html`
            <div id="container">
                <p> <strong>📋 Share this link with friends:</strong> </p>
                <div class="copy-link">
                    <input type="text" .value=${this.url} readonly>
                    <button
                        style=${this.copied ? "background: #27ae60" : ""}
                        @click=${this.copy}
                    >
                        ${this.copied ? "Copied!" : "Copy"}
                    </button>
                </div>
            </div>
        `;
    }

    private copy() {
        navigator.clipboard.writeText(this.url).then(() => {
            this.copied = true;
            setTimeout(() => { this.copied = false; }, 2000);
        });
    }
}