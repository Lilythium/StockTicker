import {css, html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import { PlayerId, PlayerState, Stock, StockPrices } from '../../common';
import { CURRENT_PLAYER_ID, format_money } from '../params';

@customElement("player-card")
export default class PlayerCard extends LitElement {
    @property()
    phase: "trading" | "dice" = "trading";

    @property()
    player_id: PlayerId | undefined

    @property()
    state: PlayerState | undefined

    @property()
    prices: StockPrices | undefined

    // use light dom
    protected createRenderRoot(): HTMLElement | DocumentFragment { return this; }

    render() {
        const is_you = this.player_id as PlayerId === CURRENT_PLAYER_ID;
        const is_offline = !this.state?.is_connected;
        const is_done = this.state?.done_turn;

        let portfolio_html = [];
        let total_shares = 0;
        let total_value = 0;

        if (this.state && this.prices) {
            for(const stock of Object.keys(this.state.portfolio)) {
                const shares = this.state.portfolio[stock as Stock];
                const price = this.prices[stock as Stock];

                const value = shares * price;
                total_shares += shares;
                total_value += value;

                portfolio_html.push(html`
                    <tr>
                        <td class="stock-name">${stock}</td>
                        <td class="stock-qty">${shares.toLocaleString()} <small>SHRS</small></td>
                        <td class="stock-val">$${format_money(value)}</td>
                    </tr>
                `);
            }
        }

        return html`
            <div class="player-card ${is_you ? 'current-player' : ''} ${is_offline ? 'disconnected' : ''}">
                <div class="player-header-row">
                    <div class="player-identity">
                        <span class="player-name">${this.state?.name}</span>
                        ${is_you ? html`<span class="you-badge">YOU</span>` : ''}
                        ${is_offline ? html`<span class="disconnected-badge">OFFLINE</span>` : ''}
                        ${(is_done && this.phase === 'trading') ? html`<span class="done-check">✅</span>` : ''}
                    </div>
                    <div class="player-cash">
                        $${format_money(this.state?.cash ?? 0)}
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
            </div>
        `;
    }
}