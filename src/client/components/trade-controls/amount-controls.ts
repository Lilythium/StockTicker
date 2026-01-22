import {css, html, LitElement} from 'lit';
import {customElement, query, state} from 'lit/decorators.js';

import trade_control_styles from "../../styles/trade-controls.js";

@customElement("amount-controls")
export default class AmountControls extends LitElement {
    @state()
    amount: number = 500;

    static styles = [
        trade_control_styles,
        css`
            .custom-number-input {
                position: relative;
                width: 100px; /* Slightly reduced width to make room */
            }

            .amount-input {
                width: 100%;
                height: 42px !important; /* Matches height of grid */
                font-size: 16px;
            }

            .spin-buttons {
                position: absolute;
                right: 3px;
                top: 3px;
                bottom: 3px;
                width: 20px;
                display: flex;
                flex-direction: column;
            }

            .spin-btn {
                flex: 1;
                background: #eee;
                border: 1px solid var(--ink-black);
                cursor: pointer;
                font-size: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 0;
                padding: 0;

                &:disabled {
                    opacity: 0.5; cursor: not-allowed;               
                }
            }

            .share-quick-buttons {
                display: grid;
                grid-template-columns: 1fr 1fr; /* 2 Columns */
                gap: 2px;
                width: 80px; /* Fixed width for the grid */
            }

            .qty-btn {
                display: flex;
                align-items: center;
                justify-content: center;
                flex: 1;
                min-width: 0;
                padding: 0;
                font-size: 11px;
                height: 20px; /* Half height of the input box */
                box-shadow: 3px 3px 0 rgba(0,0,0,0.4) !important;
                background: #5d7d8a !important;

                &:active {
                    background-color: #ADD8E6  !important;
                    color: var(--ink-black) !important;
                    box-shadow: inset 3px 3px 0 rgba(0,0,0,0.2) !important; /* Pressed effect */
                    transform: translate(1px, 1px);
                }
            }
        `
    ];

    set_amount(amount: number) {
        this.amount = amount;
        this.dispatchEvent(new CustomEvent("amount-changed", { detail: amount }));
    }

    delta_amount(delta: number) {
        this.amount += delta;
        this.dispatchEvent(new CustomEvent("amount-changed", { detail: this.amount }));
    }

    render() {
        return html`
            <div class="custom-number-input">
                <input
                    type="number"
                    id="amountInput"
                    class="amount-input"
                    .value=${this.amount.toString()}
                    readonly
                >
                <div class="spin-buttons">
                    <button
                        type="button"
                        class="spin-btn spin-up"
                        @click=${() => this.delta_amount(+500)}
                    >▲</button>
                    <button
                        type="button"
                        class="spin-btn spin-down"
                        @click=${() => this.delta_amount(-500)}
                     >▼</button>
                </div>
            </div>
            <div class="share-quick-buttons">
                ${[
                    [500, "500"],
                    [1000, "1K"],
                    [2000, "2K"],
                    [5000, "5K"],
                ].map(([amount, display]) => html`
                    <button
                        class="qty-btn"
                        @click=${() => this.set_amount(amount as number)}
                    >${display}</button>
                `)}
            </div>
        `;
    }
}