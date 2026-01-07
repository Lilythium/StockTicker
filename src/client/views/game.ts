import SocketClient from "../socket_client.js";
import {
    ActiveGameState,
    GameState,
    PlayerId,
    Stock,
} from "../../common/index.js";
import { CURRENT_PLAYER_ID, format_money } from "../params.js";

import "../components/game-header.js";
import "../components/trade-controls/index.js";
import "../components/stock-chart.js";
import GameHeader from "../components/game-header.js";
import TradeControls from "../components/trade-controls/index.js";
import StockChart from "../components/stock-chart.js";

const trade_controls = document.getElementById("tradeControls") as TradeControls;
const game_header = document.getElementById("gameHeader") as GameHeader;
const roll_button = document.getElementById("btnRollDice") as HTMLButtonElement;
const done_trading_checkbox = document.getElementById("doneTradingCheckbox") as HTMLInputElement;
const stock_chart = document.getElementById("stockChart") as StockChart;

const socket_client = new SocketClient("active", io => {
    io.on("update", (state: GameState) => {
        // Collapse GameState to ActiveGameState
        if (state.status != "active") return;

        switch (state.phase) {
            case "trading":
                trade_controls.disabled = false;
                done_trading_checkbox.disabled = false;
                break;
            case "dice":
                trade_controls.disabled = true;
                done_trading_checkbox.disabled = true;
                break;
        }

        let player_turn_id: PlayerId | undefined;
        for (const [id, player] of state.players) {
            if (!player.done_turn) {
                player_turn_id = id;
                break;
            }
        }
        const is_my_turn = player_turn_id === CURRENT_PLAYER_ID;

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
       
        trade_controls.prices = state.prices;
        game_header.update(state);
        stock_chart.prices = state.prices;
        update_players(state);
    });
});

trade_controls.addEventListener("trade", e => {
    socket_client.submit_action(e.detail);
});

done_trading_checkbox.addEventListener("change", () => {
    socket_client.trading_check(done_trading_checkbox.checked);
});

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