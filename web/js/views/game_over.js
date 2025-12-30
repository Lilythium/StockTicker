/**
 * Game Over View - Results and rankings
 */

class GameOverView {
    constructor() {
        this.gameState = null;
        this.stateReceived = false;
    }

    async render(container, params) {
        // Get game ID from session
        const gameId = SessionManager.getGameId();
        
        if (!gameId) {
            console.log('❌ No game ID, redirecting to lobby');
            window.router.navigate('/');
            return;
        }

        // Show loading state
        container.innerHTML = `
            <div class="end-container">
                <header class="end-header">
                    <h1>🎮 Game Over</h1>
                    <p style="text-align: center; padding: 40px; color: #666;">
                        Loading final results...
                    </p>
                </header>
            </div>
        `;

        // Setup socket handler BEFORE requesting state
        this.setupSocketHandlers();

        // Ensure we're connected
        if (!window.gameSocket.connected) {
            console.log('🔌 Not connected, connecting...');
            window.gameSocket.connect();
            
            // Wait for connection
            await new Promise((resolve) => {
                const checkConnection = setInterval(() => {
                    if (window.gameSocket.connected) {
                        clearInterval(checkConnection);
                        resolve();
                    }
                }, 100);
                
                // Timeout after 5 seconds
                setTimeout(() => {
                    clearInterval(checkConnection);
                    resolve();
                }, 5000);
            });
        }

        // Request state from server
        console.log('📊 Requesting final game state...');
        window.gameSocket.requestState();

        // Wait for state to arrive
        const stateReceived = await this.waitForState();

        if (!stateReceived || !this.gameState) {
            console.error('❌ Failed to get game state');
            container.innerHTML = `
                <div class="end-container">
                    <header class="end-header">
                        <h1>⚠️ Error</h1>
                        <p style="text-align: center; padding: 20px;">
                            Unable to load game results. The game may have expired.
                        </p>
                        <button onclick="window.router.navigate('/')" class="btn-primary">
                            Return to Lobby
                        </button>
                    </header>
                </div>
            `;
            return;
        }

        // Check if game is actually over
        if (!this.gameState.game_over) {
            console.log('⚠️ Game not over, redirecting...');
            if (this.gameState.status === 'active') {
                window.router.navigate('/game');
            } else {
                window.router.navigate('/waiting');
            }
            return;
        }

        // Render the game over screen
        this.renderGameOver(container);
    }

    setupSocketHandlers() {
        window.gameSocket.onStateUpdate = (state) => {
            console.log('📥 Received game state:', state);
            this.gameState = state;
            this.stateReceived = true;
        };
    }

    async waitForState() {
        return new Promise((resolve) => {
            // If we already have state, resolve immediately
            if (this.stateReceived && this.gameState) {
                resolve(true);
                return;
            }

            // Wait for state update
            let attempts = 0;
            const maxAttempts = 30; // 3 seconds

            const checkState = setInterval(() => {
                attempts++;
                
                if (this.stateReceived && this.gameState) {
                    clearInterval(checkState);
                    resolve(true);
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkState);
                    console.error('❌ Timeout waiting for game state');
                    resolve(false);
                }
            }, 100);
        });
    }

    renderGameOver(container) {
        const rankings = this.gameState.final_rankings || [];
        const winner = this.gameState.winner || null;
        const gameId = SessionManager.getGameId();
        const playerId = SessionManager.getPlayerId();
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
                            <button onclick="window.currentGameOverView.returnToLobby()" 
                                    class="btn-primary" style="margin-top: 20px;">
                                Return to Lobby
                            </button>
                        </div>
                    </section>

                    <section class="chart-column">
                        <h2 class="section-title">Performance History</h2>
                        <div class="chart-placeholder">
                            ${Object.keys(networthHistory).length > 0 ? 
                                '<canvas id="networthChart" width="600" height="400"></canvas>' : 
                                `<div class="placeholder-content" style="padding: 60px 20px; text-align: center;">
                                    <p style="font-size: 18px; margin-bottom: 10px;">📈</p>
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
            return '<p style="text-align: center; padding: 20px; color: #666;">No game history available</p>';
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

    returnToLobby() {
        // Leave game and clear session
        window.gameSocket.leaveGame();
        SessionManager.clear();
        
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
        window.gameSocket.onStateUpdate = null;
        window.currentGameOverView = null;
    }
}