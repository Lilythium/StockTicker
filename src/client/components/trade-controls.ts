import {css, html, LitElement} from 'lit';
import {customElement, property, query, state} from 'lit/decorators.js';
import { PlayerAction, Stock, StockPrices } from "../../common/index.js";
import { format_money } from "../params.js";

declare global {
  interface HTMLElementEventMap {
    'trade': CustomEvent<PlayerAction>;
  }
}

@customElement("trade-controls")
export default class TradeControls extends LitElement {
    @property({type: Boolean})
    disabled = true
    
    @state()
    prices: StockPrices | undefined;

    @state()
    stock: Stock = "Gold";

    @state()
    amount: number = 500;

    @query("#stockSelect")
    stock_select!: HTMLSelectElement;

    @query("#amountInput")
    amount_input!: HTMLInputElement;

    static styles = css`
        :host {
            display: flex;
            flex-direction: row;
            gap: 10px;
            width: 100%;
            align-items: center;
            justify-content: center;
        }
        .trade-row { display: flex; justify-content: center; align-items: center; }

        .amount-controls {
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: 8px;
            width: auto;
        }

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
        }
        .spin-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .share-quick-buttons {
            display: grid;
            grid-template-columns: 1fr 1fr; /* 2 Columns */
            gap: 2px;
            width: 80px; /* Fixed width for the grid */
        }

        .share-quick-buttons .qty-btn {
            flex: 1;
            min-width: 0;
            padding: 0;
            font-size: 11px;
            height: 20px; /* Half height of the input box */
        }

        .qty-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 3px 3px 0 rgba(0,0,0,0.4) !important;
        }

        .qty-btn.active {
            background-color: #ADD8E6  !important;
            color: var(--ink-black) !important;
            box-shadow: inset 3px 3px 0 rgba(0,0,0,0.2) !important; /* Pressed effect */
            transform: translate(1px, 1px);
        }

        .cost-display-container { width: 100%; max-width: 200px; }
        .trade-action-buttons {
            display: flex;
            gap: 10px;
            width: 100%;
            max-width: 160px;
            justify-content: center;
        }
        .trade-action-buttons .btn-buy, .trade-action-buttons .btn-sell {
            flex: 1;
            height: 42px;
            font-size: 15px;
            font-weight: bold;
        }

        .btn-buy { background: #27ae60 !important; }
        .btn-sell { background: #e74c3c !important; }
        .qty-btn { background: #5d7d8a !important; }

        .select-gold { background-color: #fde68a !important; }
        .select-silver { background-color: #d8dcdf !important; }
        .select-oil { background-color: #b3bce5 !important; }
        .select-bonds { background-color: #a8d2f0 !important; }
        .select-industrials { background-color: #dcc2e8 !important; }
        .select-grain { background-color: #f6bfa6 !important; }

        .stock-select option {
            padding: 10px;
            font-weight: bold;
        }

        .btn-buy, .btn-sell, .qty-btn {
            border: 3px solid var(--ink-black) !important;
            font-family: var(--retro-font);
            text-transform: uppercase;
            font-weight: bold;
            color: white;
            cursor: pointer;
            transition: all 0.1s;
            box-shadow: 4px 4px 0 rgba(0,0,0,0.4);
        }

        .btn-buy:active:not(:disabled), .btn-sell:active:not(:disabled), .qty-btn:active:not(:disabled) {
            transform: translate(2px, 2px);
            box-shadow: 1px 1px 0 rgba(0,0,0,0.4);
        }

        .stock-select, .amount-input, .cost-display {
            background: #ffffff;
            border: 3px solid var(--ink-black) !important;
            color: var(--ink-black) !important;
            font-family: var(--ticker-font);
            font-weight: bold;
            box-shadow: inset 3px 3px 0 rgba(0,0,0,0.2) !important;
            text-align: center;
            text-align-last: center;
            box-sizing: border-box;
        }

        .stock-select { width: 150px; height: 42px !important; }
        .cost-display {
            background: #eef3f6 !important;
            height: 42px !important;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0 10px;
        }
    `;

    stock_changed(e: InputEvent) {
        const element = e.target as HTMLInputElement;
        this.stock = element.value as Stock;
    }

    amount_changed(e: InputEvent) {
        const element = e.target as HTMLInputElement;
        this.amount = parseInt(element.value);
    }

    set_amount(amount: number) {
        this.amount_input.value = amount.toString();
        this.amount_input.dispatchEvent(new Event("input"));
    }

    trade(direction: "buy" | "sell") {
        this.dispatchEvent(new CustomEvent("trade", {
            detail: {
                kind: "trade",
                stock: this.stock_select.value as Stock,
                shares: parseInt(this.amount_input.value),
                direction
            }
        }));        
    }

    render() {
        let cost_string = "0.00";
        if(this.prices !== undefined) {
            const stock_price = this.prices[this.stock];
            const cost = this.amount * stock_price;
            cost_string = format_money(cost);
        }

        return html`
            <select
                id="stockSelect"
                class="stock-select"
                @input=${this.stock_changed}
            >
                <option value="Gold" style="background-color: #fde68a;">Gold</option>
                <option value="Silver" style="background-color: #d8dcdf;">Silver</option>
                <option value="Oil" style="background-color: #b3bce5;">Oil</option>
                <option value="Bonds" style="background-color: #a8d2f0;">Bonds</option>
                <option value="Industrials" style="background-color: #dcc2e8;">Industrials</option>
                <option value="Grain" style="background-color: #f6bfa6;">Grain</option>
            </select>

            <div class="amount-controls">
                <div class="custom-number-input">
                    <input
                        type="number"
                        id="amountInput"
                        class="amount-input"
                        value="500"
                        readonly
                    >
                    <div class="spin-buttons">
                        <button type="button" class="spin-btn spin-up">▲</button>
                        <button type="button" class="spin-btn spin-down">▼</button>
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
            </div>

            <input type="text" id="costDisplay" class="cost-display" value="COST: $${cost_string}" readonly>

            <div class="trade-action-buttons">
                <button
                    type="button"
                    id="btnBuy"
                    class="btn-buy"
                    ?disabled=${this.disabled}
                    @click=${() => this.trade("buy")}
                >Buy</button>
                <button
                    type="button"
                    id="btnSell"
                    class="btn-sell"
                    ?disabled=${this.disabled}
                    @click=${() => this.trade("sell")}
                >Sell</button>
            </div>
        `;
    }
}