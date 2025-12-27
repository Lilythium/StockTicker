/* ===== SOCKET.IO CLIENT FOR STOCK TICKER GAME ===== */

class GameSocketClient {
    constructor(serverUrl = 'http://127.0.0.1:9999') {
        this.serverUrl = serverUrl;
        this.socket = null;
        this.gameId = null;
        this.playerId = null;
        this.playerSlot = null;
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;

        // Event handlers
        this.onStateUpdate = null;
        this.onDiceRolled = null;
        this.onPhaseChanged = null;
        this.onGameOver = null;
        this.onError = null;
        this.onConnectionChange = null;
    }

    /**
     * Connect to the Socket.IO server
     */
    connect() {
        if (this.socket && this.socket.connected) {
            console.log('Already connected');
            return;
        }

        console.log('Connecting to Socket.IO server...');
        this.socket = io(this.serverUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: this.maxReconnectAttempts
        });

        this.setupEventHandlers();
    }

    /**
     * Setup Socket.IO event handlers
     */
    setupEventHandlers() {
        // Connection events
        this.socket.on('connect', () => {
            console.log('✅ Connected to game server');
            this.connected = true;
            this.reconnectAttempts = 0;

            if (this.onConnectionChange) {
                this.onConnectionChange(true);
            }

            // Auto-rejoin if we have a gameId
            if (this.gameId && this.playerId) {
                console.log('Auto-rejoining game after reconnection...');
                this.joinGame(this.gameId, this.playerId, window.currentPlayerName || 'Player');
            }
        });

        this.socket.on('disconnect', () => {
            console.log('❌ Disconnected from game server');
            this.connected = false;

            if (this.onConnectionChange) {
                this.onConnectionChange(false);
            }
        });

        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            this.reconnectAttempts++;

            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                console.error('Max reconnection attempts reached');
                if (this.onError) {
                    this.onError('Failed to connect to game server. Please refresh the page.');
                }
            }
        });

        // Game state updates
        this.socket.on('game_state_update', (state) => {
            console.log('📊 Game state update received');
            if (this.onStateUpdate) {
                this.onStateUpdate(state);
            }
        });

        // Join result
        this.socket.on('join_result', (data) => {
            console.log('Join result:', data);
            if (data.success) {
                // Extract player slot from game state
                const gameState = data.game_state;
                if (gameState && gameState.players) {
                    for (const [slot, player] of Object.entries(gameState.players)) {
                        if (player.player_id === this.playerId) {
                            this.playerSlot = parseInt(slot);
                            console.log(`Assigned to slot ${this.playerSlot}`);
                            break;
                        }
                    }
                }
            }
        });

        // Dice rolled
        this.socket.on('dice_rolled', (data) => {
            console.log('🎲 Dice rolled:', data);
            if (this.onDiceRolled) {
                this.onDiceRolled(data);
            }
        });

        // Phase changed
        this.socket.on('phase_changed', (data) => {
            console.log('🔄 Phase changed:', data.new_phase);
            if (this.onPhaseChanged) {
                this.onPhaseChanged(data);
            }
        });

        // Game started
        this.socket.on('game_started', (data) => {
            console.log('🎮 Game started!');
            // Reload page to show game UI
            window.location.href = 'game.php';
        });

        // Game over
        this.socket.on('game_over', (data) => {
            console.log('🏁 Game over!', data);
            if (this.onGameOver) {
                this.onGameOver(data);
            }
            // Redirect to game over page
            setTimeout(() => {
                window.location.href = `game_over.php?game_id=${this.gameId}`;
            }, 2000);
        });

        // Trade result
        this.socket.on('trade_result', (data) => {
            console.log('💰 Trade result:', data);
            if (!data.success) {
                showError(data.data?.error || 'Trade failed');
            }
        });

        // Errors
        this.socket.on('error', (data) => {
            console.error('Server error:', data.message);
            if (this.onError) {
                this.onError(data.message);
            }
        });
    }

    /**
     * Join a game
     */
    joinGame(gameId, playerId, playerName, playerCount = 4) {
        this.gameId = gameId;
        this.playerId = playerId;

        console.log(`Joining game ${gameId} as ${playerName}`);

        this.socket.emit('join_game', {
            game_id: gameId,
            player_id: playerId,
            player_name: playerName,
            player_count: playerCount
        });
    }

    /**
     * Leave the current game
     */
    leaveGame() {
        if (!this.gameId || !this.playerId) return;

        console.log('Leaving game...');

        this.socket.emit('leave_game', {
            game_id: this.gameId,
            player_id: this.playerId
        });

        this.gameId = null;
        this.playerSlot = null;
    }

    /**
     * Start the game (host only)
     */
    startGame(settings = {}) {
        if (!this.gameId) return;

        console.log('Starting game with settings:', settings);

        this.socket.emit('start_game', {
            game_id: this.gameId,
            settings: settings
        });
    }

    /**
     * Buy shares
     */
    buyShares(stock, amount) {
        if (!this.gameId || this.playerSlot === null) return;

        console.log(`Buying ${amount} shares of ${stock}`);

        this.socket.emit('buy_shares', {
            game_id: this.gameId,
            player: this.playerSlot,
            stock: stock,
            amount: amount
        });
    }

    /**
     * Sell shares
     */
    sellShares(stock, amount) {
        if (!this.gameId || this.playerSlot === null) return;

        console.log(`Selling ${amount} shares of ${stock}`);

        this.socket.emit('sell_shares', {
            game_id: this.gameId,
            player: this.playerSlot,
            stock: stock,
            amount: amount
        });
    }

    /**
     * Mark done trading
     */
    markDoneTrading() {
        if (!this.gameId || this.playerSlot === null) return;

        console.log('Marking done trading');

        this.socket.emit('done_trading', {
            game_id: this.gameId,
            player: this.playerSlot
        });
    }

    /**
     * Roll dice
     */
    rollDice() {
        if (!this.gameId || this.playerSlot === null) return;

        console.log('Rolling dice...');

        this.socket.emit('roll_dice', {
            game_id: this.gameId,
            player: this.playerSlot
        });
    }

    /**
     * Request current game state (fallback)
     */
    requestState() {
        if (!this.gameId) return;

        this.socket.emit('get_state', {
            game_id: this.gameId
        });
    }

    /**
     * Disconnect from server
     */
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.connected = false;
        }
    }

    /**
     * Check if connected
     */
    isConnected() {
        return this.socket && this.socket.connected;
    }
}

// Create global instance
window.gameSocket = new GameSocketClient();

// Auto-connect on page load
document.addEventListener('DOMContentLoaded', () => {
    // Connect to server
    gameSocket.connect();

    // Setup connection status indicator
    gameSocket.onConnectionChange = (connected) => {
        const indicator = document.getElementById('connectionStatus');
        if (indicator) {
            indicator.style.display = connected ? 'none' : 'block';
            indicator.textContent = connected ? '✅ Connected' : '❌ Reconnecting...';
            indicator.className = connected ? 'status-connected' : 'status-disconnected';
        }
    };

    // Setup error handler
    gameSocket.onError = (message) => {
        showError(message);
    };

    // If we're on a game page, join automatically
    if (window.gameId && window.currentPlayerId) {
        gameSocket.joinGame(
            window.gameId,
            window.currentPlayerId,
            window.currentPlayerName || 'Player'
        );

        // Setup state update handler
        gameSocket.onStateUpdate = handleGameStateUpdate;

        // Setup dice rolled handler
        gameSocket.onDiceRolled = handleDiceRolled;

        // Setup phase changed handler
        gameSocket.onPhaseChanged = handlePhaseChanged;
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (gameSocket) {
        gameSocket.disconnect();
    }
});