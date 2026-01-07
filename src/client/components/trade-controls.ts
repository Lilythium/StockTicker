import { PlayerAction, Stock, StockPrices } from "../../common/index.js";
import { format_money } from "../params.js";

declare global {
  interface HTMLElementEventMap {
    'trade': CustomEvent<PlayerAction>;
  }
}

export default class TradeControls extends HTMLElement {
    #prices: StockPrices | undefined;

    constructor() {
        super();
    }

    set prices(value: StockPrices) {
        this.#prices = value;
        this.update_cost_display();
    }

    set disabled(value: boolean) {
        const buy_button = document.getElementById('btnBuy') as HTMLButtonElement;
        const sell_button = document.getElementById('btnSell') as HTMLButtonElement;

        buy_button.disabled = value;
        sell_button.disabled = value;
    }

    connectedCallback() {
        this.render();

        const stock_select = document.getElementById('stockSelect') as HTMLSelectElement;
        const amount_input = document.getElementById('amountInput') as HTMLInputElement;
        const qty_buttons = document.querySelectorAll(".qty-btn");

        const buy_button = document.getElementById('btnBuy') as HTMLButtonElement;
        const sell_button = document.getElementById('btnSell') as HTMLButtonElement;

        stock_select.addEventListener("input", () => {
            if (this.#prices !== undefined) {
                this.update_cost_display();
            }
        });

        amount_input.addEventListener("input", () => {
            if (this.#prices !== undefined) {
                this.update_cost_display();
            }
        });

        for (const qty_button of qty_buttons) {
            qty_button.addEventListener("click", e => {
                amount_input.value = (e.currentTarget as HTMLButtonElement).dataset.amount!;
                amount_input.dispatchEvent(new Event("input"));
            });
        }

        buy_button.addEventListener("click", () => {
            const amount = parseInt(amount_input.value) || 0;
            this.dispatchEvent(new CustomEvent("trade", {
                detail: {
                    kind: "trade",
                    stock: stock_select.value as Stock,
                    shares: amount,
                    direction: "buy"
                }
            }));
        });

        sell_button.addEventListener("click", () => {
            const amount = parseInt(amount_input.value) || 0;
            this.dispatchEvent(new CustomEvent("trade", {
                detail: {
                    kind: "trade",
                    stock: stock_select.value as Stock,
                    shares: amount,
                    direction: "sell"
                }
            }));
        });
    }

    update_cost_display() {
        if (this.#prices === undefined) return;
        const amount_input = document.getElementById('amountInput') as HTMLInputElement;
        const stock_select = document.getElementById('stockSelect') as HTMLSelectElement;
        const cost_display = document.getElementById('costDisplay') as HTMLInputElement;

        const selected_stock = stock_select.value as Stock;
        const amount = parseInt(amount_input.value) || 0;
        const stock_price = this.#prices[selected_stock];
        const total_cost = amount * stock_price;

        cost_display.value = `COST: $${format_money(total_cost)}`;
    }

    private render() {
        this.innerHTML = `
            <select id="stockSelect" class="stock-select">
                <option value="Gold" style="background-color: #fde68a;">Gold</option>
                <option value="Silver" style="background-color: #d8dcdf;">Silver</option>
                <option value="Oil" style="background-color: #b3bce5;">Oil</option>
                <option value="Bonds" style="background-color: #a8d2f0;">Bonds</option>
                <option value="Industrials" style="background-color: #dcc2e8;">Industrials</option>
                <option value="Grain" style="background-color: #f6bfa6;">Grain</option>
            </select>

            <div class="amount-controls">
                <div class="custom-number-input">
                    <input type="number" id="amountInput" value="500" class="amount-input" readonly>
                    <div class="spin-buttons">
                        <button type="button" class="spin-btn spin-up" disabled>▲</button>
                        <button type="button" class="spin-btn spin-down" disabled>▼</button>
                    </div>
                </div>
                <div class="share-quick-buttons">
                    <button type="button" class="qty-btn" data-amount="500">500</button>
                    <button type="button" class="qty-btn" data-amount="1000">1K</button>
                    <button type="button" class="qty-btn" data-amount="2000">2K</button>
                    <button type="button" class="qty-btn" data-amount="5000">5K</button>
                </div>
            </div>

            <input type="text" id="costDisplay" class="cost-display" value="COST: $0.00" readonly>

            <div class="trade-action-buttons">
                <button type="button" id="btnBuy" class="btn-buy" disabled>Buy</button>
                <button type="button" id="btnSell" class="btn-sell" disabled>Sell</button>
            </div>
        `;
    }
}

customElements.define("trade-controls", TradeControls);