/**
 * Waiting Room View
 */

class WaitingRoomView {
    constructor() {
        this.gameState = null;
        this.isHost = false;
        this.settings = { ...window.APP_CONFIG.DEFAULT_SETTINGS };
    }

    async render(container) {
        if (!SessionManager.isInGame()) {
            window.router.navigate('/');
            return;
        }

        const gameId = SessionManager.getGameId();
        const shareLink = `${window.location.origin}${window.location.pathname}#/?game=${gameId}`;

        container.innerHTML = `
            <div class="page-wrapper">
                <div class="waiting-container">
                    <div class="game-info">
                        <h1>Waiting Room</h1>

                        <div class="game-id-display">
                            <div class="game-id-label">Game ID</div>
                            <div class="game-id-value">${gameId}</div>
                        </div>

                        <div class="share-link">
                            <p><strong>📋 Share this link with friends:</strong></p>
                            <div class="copy-link">
                                <input type="text" id="gameLink" value="${shareLink}" readonly>
                                <button class="copy-button" id="copyButton">Copy</button>
                            </div>
                        </div>

                        <div class="players-waiting">
                            <h2>👥 Players (<span id="playerCount">0</span>/4)</h2>
                            <div class="player-list" id="playerList">
                                <div class="empty-slot">Connecting...</div>
                            </div>
                        </div>

                        <div id="hostControls" style="display: none;">
                            <button id="startGameBtn" class="start-button" disabled>
                                ⛔ Need 2+ Players
                            </button>
                        </div>

                        <div id="waitingMessage" style="text-align: center; padding: 20px; display: none;">
                            ⏳ Waiting for host to start the game...
                        </div>

                        <div class="action-buttons" style="margin-top: 20px; text-align: center;">
                            <button id="leaveBtn" class="btn-leave">Leave Game</button>
                        </div>
                    </div>
                </div>

                <aside class="host-sidebar" id="hostSidebar" style="display: none;">
                    <div class="sidebar-header">
                        <h3>⚙️ GAME SETTINGS</h3>
                    </div>

                    <div class="setting-group">
                        <label>Max Rounds: <span id="val_rounds">${this.settings.max_rounds}</span></label>
                        <input type="range" id="range_max_rounds" min="1" max="50" 
                               value="${this.settings.max_rounds}" class="retro-slider">
                    </div>

                    <div class="setting-group">
                        <label>Trading Timer: <span id="val_trading">${this.settings.trading_duration}</span> min</label>
                        <input type="range" id="range_trading_duration" min="1" max="10" 
                               value="${this.settings.trading_duration}" class="retro-slider">
                    </div>

                    <div class="setting-group">
                        <label>Dice Timer: <span id="val_dice">${this.settings.dice_duration}</span> sec</label>
                        <input type="range" id="range_dice_duration" min="0" max="30" 
                               value="${this.settings.dice_duration}" class="retro-slider">
                    </div>

                    <div class="setting-group">
                        <label>Starting Cash: <span id="val_cash">$${this.settings.starting_cash.toLocaleString()}</span></label>
                        <input type="range" id="range_starting_cash" min="500" max="20000" step="500" 
                               value="${this.settings.starting_cash}" class="retro-slider">
                    </div>

                    <button type="button" class="btn-reset" id="resetBtn">↻ Reset Defaults</button>
                </aside>
            </div>
        `;

        this.setupEventListeners();
        this.setupSocketHandlers();
    }

    setupEventListeners() {
        // Copy link button
        document.getElementById('copyButton').addEventListener('click', () => {
            this.copyLink();
        });

        // Leave button
        document.getElementById('leaveBtn').addEventListener('click', () => {
            if (confirm('Leave the waiting room?')) {
                this.leaveGame();
            }
        });

        // Start game button
        document.getElementById('startGameBtn').addEventListener('click', () => {
            this.startGame();
        });

        // Settings sliders
        document.getElementById('range_max_rounds').addEventListener('input', (e) => {
            this.settings.max_rounds = parseInt(e.target.value);
            document.getElementById('val_rounds').textContent = e.target.value;
        });

        document.getElementById('range_trading_duration').addEventListener('input', (e) => {
            this.settings.trading_duration = parseInt(e.target.value);
            document.getElementById('val_trading').textContent = e.target.value;
        });

        document.getElementById('range_dice_duration').addEventListener('input', (e) => {
            this.settings.dice_duration = parseInt(e.target.value);
            document.getElementById('val_dice').textContent = e.target.value;
        });

        document.getElementById('range_starting_cash').addEventListener('input', (e) => {
            this.settings.starting_cash = parseInt(e.target.value);
            document.getElementById('val_cash').textContent = '$' + parseInt(e.target.value).toLocaleString();
        });

        // Reset button
        document.getElementById('resetBtn').addEventListener('click', () => {
            this.settings = { ...window.APP_CONFIG.DEFAULT_SETTINGS };
            this.updateSettingsUI();
        });
    }

    setupSocketHandlers() {
        window.gameSocket.onStateUpdate = (state) => {
            this.handleStateUpdate(state);
        };

        window.gameSocket.onGameStarted = () => {
            window.router.navigate('/game');
        };
    }

    handleStateUpdate(state) {
        this.gameState = state;

        // Check if game already started
        if (state.status === 'active' && state.current_round >= 1) {
            window.router.navigate('/game');
            return;
        }

        // Update player list
        this.updatePlayerList(state);

        // Update host controls
        this.isHost = (state.host_player_id === SessionManager.getPlayerId());
        this.updateHostControls(state);
    }

    updatePlayerList(state) {
        const playerList = document.getElementById('playerList');
        const playerCount = document.getElementById('playerCount');

        let activePlayers = 0;
        let html = '';

        Object.keys(state.players).forEach(slot => {
            const player = state.players[slot];
            if (!player.player_id) return;

            activePlayers++;

            const isYou = (player.player_id === SessionManager.getPlayerId());
            const isHost = (player.player_id === state.host_player_id);
            const isDisconnected = player.has_left || false;

            html += `
                <div class="player-item ${isYou ? 'you' : ''} ${isHost ? 'host' : ''}">
                    <div class="player-name">
                        ${player.name}
                        ${isYou ? '<span class="player-badge you">You</span>' : ''}
                        ${isHost ? '<span class="player-badge host">Host</span>' : ''}
                        ${isDisconnected ? '<span class="player-badge disconnected">OFFLINE</span>' : ''}
                    </div>
                    <div class="player-status">${isDisconnected ? '⌛ Wait' : 'Ready ✅'}</div>
                </div>
            `;
        });

        // Add empty slots
        const maxPlayers = state.player_count || 4;
        for (let i = activePlayers; i < maxPlayers; i++) {
            html += '<div class="empty-slot">Waiting for player...</div>';
        }

        playerList.innerHTML = html;
        playerCount.textContent = activePlayers;
    }

    updateHostControls(state) {
        const hostControls = document.getElementById('hostControls');
        const hostSidebar = document.getElementById('hostSidebar');
        const waitingMessage = document.getElementById('waitingMessage');
        const startBtn = document.getElementById('startGameBtn');

        const activePlayers = state.active_player_count || 0;
        const canStart = (activePlayers >= 2);

        if (this.isHost) {
            hostControls.style.display = 'block';
            hostSidebar.style.display = 'block';
            waitingMessage.style.display = 'none';

            startBtn.disabled = !canStart;
            startBtn.textContent = canStart ? 'Start Game' : '⛔ Need 2+ Players';
        } else {
            hostControls.style.display = 'none';
            hostSidebar.style.display = 'none';
            waitingMessage.style.display = 'block';
        }
    }

    updateSettingsUI() {
        document.getElementById('range_max_rounds').value = this.settings.max_rounds;
        document.getElementById('val_rounds').textContent = this.settings.max_rounds;

        document.getElementById('range_trading_duration').value = this.settings.trading_duration;
        document.getElementById('val_trading').textContent = this.settings.trading_duration;

        document.getElementById('range_dice_duration').value = this.settings.dice_duration;
        document.getElementById('val_dice').textContent = this.settings.dice_duration;

        document.getElementById('range_starting_cash').value = this.settings.starting_cash;
        document.getElementById('val_cash').textContent = '$' + this.settings.starting_cash.toLocaleString();
    }

    copyLink() {
        const input = document.getElementById('gameLink');
        input.select();
        document.execCommand('copy');
        
        const btn = document.getElementById('copyButton');
        btn.textContent = 'Copied!';
        btn.style.background = '#27ae60';
        
        setTimeout(() => {
            btn.textContent = 'Copy';
            btn.style.background = '';
        }, 2000);
    }

    startGame() {
        if (!this.isHost) return;

        if (confirm('Start the game now?')) {
            window.gameSocket.startGame(this.settings);
            document.getElementById('startGameBtn').disabled = true;
            document.getElementById('startGameBtn').textContent = '🎮 Starting...';
        }
    }

    leaveGame() {
        window.gameSocket.leaveGame();
        SessionManager.clear();
        window.router.navigate('/');
    }

    cleanup() {
        window.gameSocket.onStateUpdate = null;
        window.gameSocket.onGameStarted = null;
    }
}