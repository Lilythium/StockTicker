/**
 * Game Over View - Results and rankings
 */

class GameOverView {
    constructor() {
        this.gameState = null;
    }

    async render(container, params) {
        // Get game state from socket or stored state
        const gameId = window.session.getGameId();
        
        if (!gameId) {
            // No game ID, redirect to lobby
            window.router.navigate('/');
            return;
        }

        // Request final state
        window.gameSocket.requestState();

        // Wait a moment for state to arrive
        await this.waitForState();

        if (!this.gameState || !this.gameState.game_over) {
            // Game not over, redirect appropriately
            if (this.gameState?.status === 'active') {
                window.router.navigate('/game');
            } else {
                window.router.navigate('/waiting');
            }
            return;
        }

        this.renderGameOver(container);
    }

    async waitForState() {
        return new Promise((resolve) => {
            // Setup temporary handler
            const handler = (state) => {
                this.gameState = state;
                resolve();
            };

            window.gameSocket.onStateUpdate = handler;

            // Timeout after 3 seconds
            setTimeout(() => {
                window.gameSocket.onStateUpdate = null;
                resolve();
            }, 3000);
        });
    }

    renderGameOver(container) {
        const rankings = this.gameState.final_rankings || [];
        const winner = this.gameState.winner || null;
        const gameId = window.session.getGameId();
        const playerId = window.session.getPlayerId();
        const networthHistory = this.gameState.networth_history || {};

        container.innerHTML = `
            <div class="end-container">
                <header class="end-header">
                    <h1>🎮 Game Over</h1>
                    <p class="game-id-tag">Game ID: ${gameId}</p>
                    ${winner ? `
                        <p class="winner-announcement">
                            🏆 <strong>${this.escapeHtml(winner.name)}</strong> wins with
                            <strong>$${this.formatMoney(winner.networth)}</strong>!
                        </p>
                    ` : ''}
                </header>

                <div class="end-layout">
                    <section class="standings-column">
                        <h2 class="section-title">Final Standings</h2>
                        <div class="leaderboard">
                            ${this.renderRankings(rankings, playerId)}
                        </div>

                        <div class="end-actions">
                            <button onclick="window.currentGameOverView.rematch()" class="btn-primary" style="margin-bottom: 10px;">
                                🔄 Rematch
                            </button>
                            <button onclick="window.currentGameOverView.returnToLobby()" class="btn-primary">
                                Return to Lobby
                            </button>
                        </div>
                    </section>

                    <section class="chart-column">
                        <h2 class="section-title">Performance History</h2>
                        <div class="chart-placeholder">
                            ${Object.keys(networthHistory).length > 0 ? 
                                '<canvas id="networthChart" width="600" height="400"></canvas>' : 
                                `<div class="placeholder-content">
                                    <p>No performance history available</p>
                                    <p style="color: #666; font-size: 14px; margin-top: 10px;">
                                        (Net worth tracking will be available in future updates)
                                    </p>
                                </div>`
                            }
                        </div>
                    </section>
                </div>

                <section class="game-history-section">
                    <h2 class="section-title">📜 Game History</h2>
                    <div class="history-display">
                        ${this.renderHistory()}
                    </div>
                </section>
            </div>
        `;

        // Store reference to this view
        window.currentGameOverView = this;

        // Initialize chart if we have data
        if (Object.keys(networthHistory).length > 0) {
            this.initializeNetWorthChart(rankings, networthHistory);
        }
    }

    renderRankings(rankings, playerId) {
        if (!rankings || rankings.length === 0) {
            return '<div class="history-empty">No rankings available</div>';
        }

        let html = '';
        let rank = 1;

        rankings.forEach(player => {
            const isYou = (playerId && player.player_id === playerId);
            const rankClass = rank <= 3 ? `rank-${rank}` : '';
            const wasDisconnected = player.was_disconnected || false;

            html += `
                <div class="player-rank-card ${rankClass} ${isYou ? 'is-you' : ''}">
                    <div class="rank-number">${rank}</div>
                    <div class="player-info">
                        <span class="player-name">
                            ${this.escapeHtml(player.name)}
                            ${isYou ? '<span class="you-pill">you</span>' : ''}
                            ${wasDisconnected ? '<span class="disconnected-pill">disconnected</span>' : ''}
                        </span>
                        <span class="player-worth">$${this.formatMoney(player.net_worth)}</span>
                    </div>
                    ${rank === 1 ? '<div class="medal">🏆</div>' : ''}
                    ${rank === 2 ? '<div class="medal">🥈</div>' : ''}
                    ${rank === 3 ? '<div class="medal">🥉</div>' : ''}
                </div>
            `;
            rank++;
        });

        return html;
    }

    renderHistory() {
        const history = this.gameState?.history || [];
        
        if (history.length === 0) {
            return '<p>No game history available</p>';
        }

        let html = '';
        // Show last 100 entries, reversed
        const recentHistory = history.slice(-100).reverse();

        recentHistory.forEach(entry => {
            const time = entry.timestamp ? new Date(entry.timestamp * 1000).toLocaleTimeString() : '';
            const type = entry.type || 'system';
            const message = this.escapeHtml(entry.message || '');

            html += `
                <div class="history-entry history-${type}">
                    <span class="history-time">[${time}]</span>
                    <span class="history-message">${message}</span>
                </div>
            `;
        });

        return html;
    }

    initializeNetWorthChart(players, history) {
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

        // Find the maximum round reached
        let maxRound = 1;
        for (const slot in history) {
            if (history[slot].length > 0) {
                const lastEntry = history[slot][history[slot].length - 1];
                maxRound = Math.max(maxRound, lastEntry[0]);
            }
        }

        // Build the datasets for Chart.js
        const datasets = players.map((player, index) => {
            const slot = player.slot;
            const playerHistory = history[slot] || [];

            // Map rounds to data points
            const data = [];
            for (let round = 1; round <= maxRound; round++) {
                const entry = playerHistory.find(e => e[0] === round);
                if (entry) {
                    data.push({ x: round, y: entry[1] });
                }
            }

            return {
                label: player.name,
                data: data,
                borderColor: colors[index % colors.length],
                backgroundColor: colors[index % colors.length] + '20',
                borderWidth: 3,
                tension: 0.1,
                pointRadius: 5,
                pointHoverRadius: 7
            };
        });

        const canvas = document.getElementById('networthChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
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
                            callback: function(value) {
                                return '$' + value.toLocaleString();
                            }
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
                                return context.dataset.label + ': $' + context.parsed.y.toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                });
                            }
                        }
                    }
                }
            }
        });
    }

    rematch() {
        if (!confirm('Start a new game with the same settings?')) {
            return;
        }

        // Generate new game ID
        const newGameId = Math.floor(1000 + Math.random() * 9000).toString();

        // Get settings from last game
        const settings = {
            max_rounds: this.gameState.max_rounds || 15,
            trading_duration: this.gameState.trading_duration ? Math.floor(this.gameState.trading_duration / 60) : 2,
            dice_duration: this.gameState.dice_duration || 15,
            starting_cash: 5000 // Default, can't retrieve from game state easily
        };

        // Clear current game
        window.gameSocket.leaveGame();
        window.session.clear();

        // Navigate to lobby with rematch params
        window.router.navigate('/', {
            game: newGameId,
            rematch: true,
            ...settings
        });
    }

    returnToLobby() {
        // Leave game and clear session
        window.gameSocket.leaveGame();
        window.session.clear();
        
        // Navigate to lobby
        window.router.navigate('/');
    }

    formatMoney(amount) {
        if (typeof amount !== 'number') return '0.00';
        return amount.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    cleanup() {
        window.currentGameOverView = null;
    }
}