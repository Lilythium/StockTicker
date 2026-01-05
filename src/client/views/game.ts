import SocketClient from "../socket_client.js";
import {
    ActiveGameState,
    GameState,
    PlayerId,
    Stock,
    StockPrices
} from "../../interface/index.js";
import { CURRENT_PLAYER_ID, format_money } from "../params.js";

let current_state: ActiveGameState | undefined;

const roll_button = document.getElementById("btnRollDice") as HTMLButtonElement;

const stock_select = document.getElementById('stockSelect') as HTMLSelectElement;
const amount_input = document.getElementById('amountInput') as HTMLInputElement;
const qty_buttons = document.querySelectorAll(".qty-btn");

const buy_button = document.getElementById('btnBuy') as HTMLButtonElement;
const sell_button = document.getElementById('btnSell') as HTMLButtonElement;

const done_trading_checkbox = document.getElementById("doneTradingCheckbox") as HTMLInputElement;

const socket_client = new SocketClient("active", io => {
    io.on("update", (state: GameState) => {
        // Collapse GameState to ActiveGameState
        if (state.status != "active") return;
        current_state = state;

        switch (state.phase) {
            case "trading":
                buy_button.disabled = false;
                sell_button.disabled = false;
                done_trading_checkbox.disabled = false;
                break;
            case "dice":
                buy_button.disabled = true;
                sell_button.disabled = true;
                done_trading_checkbox.disabled = true;
                break;
        }
        
        update_header(state);
        update_chart(state.prices);
        update_players(state);
    });
});

stock_select.addEventListener("input", () => {
    if (current_state !== undefined) {
        update_cost_display(current_state.prices);
    }
});

amount_input.addEventListener("input", () => {
    if (current_state !== undefined) {
        update_cost_display(current_state.prices);
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
    socket_client.submit_action({
        kind: "trade",
        stock: stock_select.value as Stock,
        shares: amount,
        direction: "buy"
    });
});

sell_button.addEventListener("click", () => {
    const stock_select = document.getElementById('stockSelect') as HTMLSelectElement;
    const amount = parseInt(amount_input.value) || 0;
    socket_client.submit_action({
        kind: "trade",
        stock: stock_select.value as Stock,
        shares: amount,
        direction: "sell"
    });
});

done_trading_checkbox.addEventListener("change", () => {
    socket_client.trading_check(done_trading_checkbox.checked);
});

function update_header(state: ActiveGameState) {
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

    if(state.phase === "dice") {
        if (is_my_turn) {
            roll_button.disabled = false;
            roll_button.textContent = '🎲 ROLL!';
        } else {
            roll_button.disabled = true;
            roll_button.textContent = '⏳ Not Your Turn';
        }
    } else {
        roll_button.disabled = true;
        roll_button.textContent = '⏳ Trading Phase';
    }

    const round_display = document.querySelector('.round-display');
    if (round_display) {
        round_display.textContent = `Round ${state.round || 1}/${state.settings.max_rounds || 15}`;
    }

    update_cost_display(state.prices);
}

function update_cost_display(prices: StockPrices) {
    const stock_select = document.getElementById('stockSelect') as HTMLSelectElement;
    const cost_display = document.getElementById('costDisplay') as HTMLInputElement;

    const selected_stock = stock_select.value as Stock;
    const amount = parseInt(amount_input.value) || 0;
    const stock_price = prices[selected_stock];
    const total_cost = amount * stock_price;

    cost_display.value = `COST: $${format_money(total_cost)}`;
}

function update_chart(prices: StockPrices) {
    for (const stock_name of Object.keys(prices)) {
        const price = prices[stock_name as Stock];

        const stock_cells = document.querySelectorAll(`td[data-stock="${stock_name}"]`);
        stock_cells.forEach(cell => {
            cell.classList.remove('current-price');
            const marker = cell.querySelector('.price-marker');
            if (marker) marker.remove();
        });

        const target_cell = document.querySelector(`td[data-stock="${stock_name}"][data-price="${price}"]`);
        if (target_cell) {
            target_cell.classList.add('current-price');
            const marker = document.createElement('div');
            marker.className = 'price-marker';
            marker.textContent = price.toString();
            target_cell.appendChild(marker);
        }
    }
}

function update_players(state: ActiveGameState) {
    const player_container = document.getElementById('playersContainer') as HTMLDivElement;
    
    let html = "";
    const current_phase = "trading";
    for (const [id, player] of state.players) {
        const is_you = id as PlayerId === CURRENT_PLAYER_ID;
        const is_offline = !player.is_connected;
        const is_done = player.done_turn;

        let portfolio_html = "";
        let total_shares = 0;
        let total_value = 0;

        for(const stock of Object.keys(player.portfolio)) {
            const shares = player.portfolio[stock as Stock];
            const price = state.prices[stock as Stock];

            const value = shares * price;
            total_shares += shares;
            total_value += value;

            portfolio_html += `
                <tr>
                    <td class="stock-name">${stock}</td>
                    <td class="stock-qty">${shares.toLocaleString()} <small>SHRS</small></td>
                    <td class="stock-val">$${format_money(value)}</td>
                </tr>`;
        }

        html += `
            <div class="player-card ${is_you ? 'current-player' : ''} ${is_offline ? 'disconnected' : ''}">
                <div class="player-header-row">
                    <div class="player-identity">
                        <span class="player-name">${player.name}</span>
                        ${is_you ? '<span class="you-badge">YOU</span>' : ''}
                        ${is_offline ? '<span class="disconnected-badge">OFFLINE</span>' : ''}
                        ${(is_done && current_phase === 'trading') ? '<span class="done-check">✅</span>' : ''}
                    </div>
                    <div class="player-cash">
                        $${format_money(player.cash)}
                    </div>
                </div>
                <div class="portfolio-section">
                    <table class="portfolio-table">
                        <tbody>
                            ${portfolio_html}
                            <tr class="portfolio-totals">
                                <td class="stock-name"><strong>Totals</strong></td>
                                <td class="stock-qty">${total_shares.toLocaleString()}<small> SHRS</small></td>
                                <td class="stock-val">
                                    $${format_money(total_value)}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>`;
    }

    player_container.innerHTML = html;
}