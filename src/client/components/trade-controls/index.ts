import {css, html, LitElement} from 'lit';
import {customElement, property, query, state} from 'lit/decorators.js';
import { PlayerAction, Stock, StockPrices } from "../../../common/index.js";
import { format_money } from "../../params.js";

import "./amount-controls.js";
import trade_control_styles from "../../styles/trade-controls.js"

declare global {
  interface HTMLElementEventMap {
    'amount-changed': CustomEvent<number>;
    'trade': CustomEvent<PlayerAction>;
  }
}

@customElement("trade-controls")
export default class TradeControls extends LitElement {
    @property({type: Boolean})
    disabled = true
    
    @property()
    prices: StockPrices | undefined;

    @state()
    stock: Stock = "Gold";

    @state()
    amount: number = 500;

    @query("#stockSelect")
    stock_select!: HTMLSelectElement;

    static styles = [
        trade_control_styles,
        css`
            :host {
                display: flex;
                flex-direction: row;
                gap: 10px;
                width: 100%;
                align-items: center;
                justify-content: center;
            }
            .trade-row { display: flex; justify-content: center; align-items: center; }

            amount-controls {
                display: flex;
                flex-direction: row;
                align-items: center;
                gap: 8px;
                width: auto;
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

            .stock-select { width: 150px; height: 42px !important; }
            
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
            
            .btn-buy:active:not(:disabled), .btn-sell:active:not(:disabled), .qty-btn:active:not(:disabled) {
                transform: translate(2px, 2px);
                box-shadow: 1px 1px 0 rgba(0,0,0,0.4);
            }

            .cost-display {
                background: #eef3f6 !important;
                height: 42px !important;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0 10px;
            }
        `
    ];

    stock_changed(e: InputEvent) {
        const element = e.target as HTMLInputElement;
        this.stock = element.value as Stock;
    }

    amount_changed(e: CustomEvent<number>) {
        this.amount = e.detail;
    }

    trade(direction: "buy" | "sell") {
        this.dispatchEvent(new CustomEvent("trade", {
            detail: {
                kind: "trade",
                stock: this.stock_select.value as Stock,
                shares: this.amount,
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

            <amount-controls
                @amount-changed=${this.amount_changed} 
            ></amount-controls>

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