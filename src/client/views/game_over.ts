import {html, LitElement} from 'lit';
import {customElement, query, state} from 'lit/decorators.js';
import { CURRENT_PLAYER_ID, format_money, GAME_ID } from '../params.js';
import { FinishedGameState, PlayerAssets, PlayerId, PlayerState, Stock, StockPrices } from '../../common/index.js';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@customElement("game-over-view")
export default class GameOverView extends LitElement {
    @state()
    private state?: FinishedGameState;

    @state()
    private error?: string;

    @query("canvas")
    private canvas?: HTMLCanvasElement;
    private chart?: Chart;

    // use light dom
    protected createRenderRoot(): HTMLElement | DocumentFragment { return this; }

    connectedCallback(): void {
        super.connectedCallback();
        this.fetch_results();
    }

    async fetch_results() {
        try {
            const res = await fetch(`/results?game_id=${GAME_ID}`);
            if (!res.ok) throw new Error(res.statusText);
            this.state = await res.json() as FinishedGameState;
        } catch (e) {
            this.error = (e as Error).message;
            console.log(`Error getting results: ${this.error}`);
        }       
    }

    /**
     * Calculate player networth
     * @param player
     * @returns networth in cents
     */
    networth(assets?: PlayerAssets, prices?: StockPrices): number | undefined {
        const effective_prices = this.state?.prices ?? prices;
        if (!effective_prices || !assets) return;
        let networth = assets.cash;
        for (const stock of Object.keys(assets.portfolio)) {
            const shares = assets.portfolio[stock as Stock];
            const price = effective_prices[stock as Stock];
            networth += shares * price;
        }
        return networth;
    }

    render() {
        const ranked = this.state
            ? this.state.players.sort(([_a, a], [_b, b]) =>
                (this.networth(b.assets) ?? 0)
                - (this.networth(a.assets) ?? 0)
            )
            : undefined;
        
        const winner = ranked ? ranked[0][1] : undefined;

        const rankings = this.state ? this.state.players
        .map(([id, player], i) => {
            const rank = i + 1;
            const is_you = id === CURRENT_PLAYER_ID;
            const rank_class = rank <= 3 ? `rank-${rank}` : '';
            const is_disconnected = !player.is_connected;

            return html`
                <div class="player-rank-card ${rank_class} ${is_you ? 'is-you' : ''}">
                    <div class="rank-number">${rank}</div>
                    <div class="player-info">
                        <span class="player-name">
                            ${player.name}
                            ${is_you ? html`<span class="you-pill">you</span>` : ''}
                            ${is_disconnected ? html`<span class="disconnected-pill">disconnected</span>` : ''}
                        </span>
                        <span class="player-worth">$${format_money(this.networth(player.assets) ?? 0)}</span>
                    </div>
                    ${rank === 1 ? html`<div class="medal">🏆</div>` : ''}
                    ${rank === 2 ? html`<div class="medal">🥈</div>` : ''}
                    ${rank === 3 ? '<div class="medal">🥉</div>' : ''}
                </div>
            `;
        }) : html`'<div class="history-empty">No rankings available</div>`;

        return html`<div class="end-container">
                <header class="end-header">
                    <h1>🎮 Game Over</h1>
                    <p class="game-id-tag">Game ID: ${GAME_ID}</p>
                    <p class="winner-announcement">
                        🏆
                        <strong>${winner?.name ?? "Error"}</strong> wins with
                        <strong>$${format_money(this.networth(winner?.assets) ?? 0)}</strong>!
                    </p>
                </header>

                <div class="end-layout">
                    <section class="standings-column">
                        <h2 class="section-title">Final Standings</h2>
                        <div class="leaderboard"> ${rankings} </div>

                        <div class="end-actions">
                            <button onclick="window.currentGameOverView.returnToLobby()" 
                                    class="btn-primary" style="margin-top: 20px;">
                                Return to Lobby
                            </button>
                        </div>
                    </section>

                    <section class="chart-column">
                        <h2 class="section-title">Performance History</h2>
                        <div class="chart-placeholder">
                            ${
                                rankings
                                ? html`<canvas id="networthChart" width="600" height="400"></canvas>`
                                : html`<div class="placeholder-content" style="padding: 60px 20px; text-align: center;">
                                    <p style="font-size: 18px; margin-bottom: 10px;">📈</p>
                                    <p>No performance history available</p>
                                </div>`
                            }
                        </div>
                    </section>
                </div>

                <section class="game-history-section">
                    <h2 class="section-title">📜 Game History</h2>
                    <div class="history-display">
                    </div>
                </section>
            </div>`;
    }

    updated() {
        if (!this.canvas) return;
        
        const ctx = this.canvas.getContext('2d');
        if(!ctx) return;

        if (this.chart) this.chart.destroy();

        if (!this.state) return;

        const colors = [
            'rgb(241, 196, 15)',  // Gold
            'rgb(189, 195, 199)', // Silver
            'rgb(52, 152, 219)',  // Blue
            'rgb(155, 89, 182)',  // Purple
            'rgb(46, 204, 113)',  // Green
            'rgb(230, 126, 34)',  // Orange
            'rgb(231, 76, 60)',   // Red
            'rgb(149, 165, 166)'  // Gray
        ];

        const datasets = this.state.players.map(([_, player], index) => {
            console.log(player.asset_history);
            player.asset_history.forEach((assets) => console.log(this.networth(assets) ?? 0));
            const data = [];
            for (let i = 0; i <= this.state!.settings.max_rounds; i++) {
                data.push({
                    x: i,
                    y: this.networth(player.asset_history[i], this.state?.stock_history[i]) ?? 0
                });
            }
            return {
                label: player.name,
                data,
                borderColor: colors[index % colors.length],
                backgroundColor: colors[index % colors.length] + '20',
                borderWidth: 3,
                tension: 0.1,
                pointRadius: 5,
                pointHoverRadius: 7
            };
        });

        console.log(datasets);
        
        new Chart(ctx, {
            type: 'line',
            data: { datasets: datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'linear',
                        title: { display: true, text: 'Round', font: { size: 14, weight: 'bold' } },
                        ticks: { stepSize: 1 }
                    },
                    y: {
                        title: { display: true, text: 'Net Worth ($)', font: { size: 14, weight: 'bold' } },
                        ticks: {
                            callback: value => "$" + format_money(+value)
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: { padding: 15 }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + format_money(context.parsed.y ?? 0);
                            }
                        }
                    }
                }
            }
        });
    }
}