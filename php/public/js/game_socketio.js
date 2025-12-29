/* ===== SOCKET.IO CLIENT FOR STOCK TICKER GAME ===== */

class GameSocketClient {
    constructor(serverUrl = 'http://127.0.0.1:9999') {
        this.serverUrl = serverUrl;
        this.socket = io(serverUrl, { autoConnect: false });
        this.gameId = null;
        this.playerId = null;
        this.playerSlot = null;
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.isJoining = false;
        this.hasJoined = false;

        this.socket.onAny((eventName, ...args) => {
            console.log(`🔍 Raw Socket Event: ${eventName}`, args);
        });

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
            reconnectionAttempts: this.maxReconnectAttempts,
            forceNew: false,
            multiplex: true,
            timeout: 20000,
            pingInterval: 25000,
            pingTimeout: 60000
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

            if (this.gameId && this.playerId && this.hasJoined && !this.isJoining) {
                console.log('🔄 Reconnected - rejoining game...');
                this.joinGame(this.gameId, this.playerId, window.playerName || 'Player');
            }
        });

        this.socket.on('disconnect', (reason) => {
            console.log(`❌ Disconnected: ${reason}`);
            this.connected = false;

            if (this.onConnectionChange) {
                this.onConnectionChange(false);
            }

            if (reason === 'io client disconnect') {
                console.log('🛑 Intentional disconnect - not reconnecting');
                this.hasJoined = false;
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

            if (this.playerSlot === null && this.playerId && state.players) {
                for (const [slot, player] of Object.entries(state.players)) {
                    if (player.player_id === this.playerId) {
                        this.playerSlot = parseInt(slot);
                        console.log(`✓ Auto-detected player slot: ${this.playerSlot}`);
                        break;
                    }
                }
            }

            if (this.onStateUpdate) {
                this.onStateUpdate(state);
            }
        });

        // Join result
        this.socket.on('join_result', (data) => {
            console.log('Join result:', data);
            this.isJoining = false;

            if (data.success) {
                this.hasJoined = true;

                const gameState = data.game_state;
                if (gameState && gameState.players) {
                    for (const [slot, player] of Object.entries(gameState.players)) {
                        if (player.player_id === this.playerId) {
                            this.playerSlot = parseInt(slot);
                            console.log(`✓ Assigned to slot ${this.playerSlot}`);
                            break;
                        }
                    }
                }
            } else {
                console.error('Join failed:', data.error);
                this.hasJoined = false;
            }
        });

        // Dice rolled
        this.socket.on('dice_rolled', (data) => {
            console.log('🎲 Dice rolled:', data);
            if (this.onDiceRolled) {
                this.onDiceRolled(data);
            }
        });

        // Phase transition (SERVER CONTROLLED)
        this.socket.on('phase_transition', (data) => {
            console.log('🔄 SERVER PHASE TRANSITION:', data);
            if (this.onPhaseChanged) {
                this.onPhaseChanged(data);
            }
        });

        // Legacy phase changed event (keep for compatibility)
        this.socket.on('phase_changed', (data) => {
            console.log('🔄 Phase changed:', data.new_phase);
            if (this.onPhaseChanged) {
                this.onPhaseChanged(data);
            }
        });

        // Game started
        this.socket.on('game_started', (data) => {
            console.log('🎮 Game started!');
            if (!window.location.pathname.includes('game.php')) {
                window.location.href = 'game.php';
            }
        });

        // Game over
        this.socket.on('game_over', (data) => {
            console.log('🏁 Game over!', data);
            if (this.onGameOver) {
                this.onGameOver(data);
            }
            setTimeout(() => {
                window.location.href = `game_over.php?game_id=${this.gameId}`;
            }, 2000);
        });

        // Trade result
        this.socket.on('trade_result', (data) => {
            console.log('💰 Trade result:', data);
            if (!data.success) {
                if (window.showError) {
                    window.showError(data.data?.error || 'Trade failed');
                }
            }
        });

        // Errors
        this.socket.on('error', (data) => {
            console.error('Server error:', data.message);
            if (this.onError) {
                this.onError(data.message);
            } else if (window.showError) {
                window.showError(data.message);
            }
        });
    }

    /**
     * Join a game
     */
    joinGame(gameId, playerId, playerName, playerCount = 4) {
        if (this.isJoining) {
            console.log('⏳ Join already in progress, skipping...');
            return;
        }

        if (this.hasJoined && this.gameId === gameId && this.playerId === playerId) {
            console.log('✓ Already joined this game, skipping...');
            return;
        }

        this.isJoining = true;
        this.gameId = gameId;
        this.playerId = playerId;

        console.log(`Joining game ${gameId} as ${playerName}`);

        this.socket.emit('join_game', {
            game_id: gameId,
            player_id: playerId,
            player_name: playerName,
            player_count: playerCount
        });

        setTimeout(() => {
            if (this.isJoining) {
                console.warn('⚠️ Join timeout - releasing lock');
                this.isJoining = false;
            }
        }, 5000);
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

        this.hasJoined = false;
        this.gameId = null;
        this.playerSlot = null;
    }

    /**
     * Disconnect from server (intentional)
     */
    disconnect() {
        if (this.socket) {
            this.hasJoined = false;
            this.socket.disconnect();
            this.connected = false;
        }
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
        if (!this.gameId || this.playerSlot === null) {
            console.error('❌ Cannot buy shares: gameId or playerSlot not set', {
                gameId: this.gameId,
                playerSlot: this.playerSlot
            });
            if (window.showError) {
                window.showError('Not properly connected to game. Please refresh.');
            }
            return;
        }

        console.log(`Buying ${amount} shares of ${stock} (slot: ${this.playerSlot})`);

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
        if (!this.gameId || this.playerSlot === null) {
            console.error('❌ Cannot sell shares: gameId or playerSlot not set', {
                gameId: this.gameId,
                playerSlot: this.playerSlot
            });
            if (window.showError) {
                window.showError('Not properly connected to game. Please refresh.');
            }
            return;
        }

        console.log(`Selling ${amount} shares of ${stock} (slot: ${this.playerSlot})`);

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
        if (!this.gameId || this.playerSlot === null) {
            console.error('❌ Cannot mark done trading: gameId or playerSlot not set', {
                gameId: this.gameId,
                playerSlot: this.playerSlot
            });
            if (window.showError) {
                window.showError('Not properly connected to game. Please refresh.');
            }
            return;
        }

        console.log(`Marking done trading (slot: ${this.playerSlot})`);

        this.socket.emit('done_trading', {
            game_id: this.gameId,
            player: this.playerSlot
        });
    }

    /**
     * Roll dice
     */
    rollDice() {
        if (!this.gameId || this.playerSlot === null) {
            console.error('❌ Cannot roll dice: gameId or playerSlot not set', {
                gameId: this.gameId,
                playerSlot: this.playerSlot
            });
            if (window.showError) {
                window.showError('Not properly connected to game. Please refresh.');
            }
            return;
        }

        console.log(`Rolling dice (slot: ${this.playerSlot})`);

        this.socket.emit('roll_dice', {
            game_id: this.gameId,
            player: this.playerSlot
        });
    }

    /**
     * Request current game state (fallback/manual refresh)
     */
    requestState() {
        if (!this.gameId) return;

        console.log('Requesting game state...');
        
        this.socket.emit('get_state', {
            game_id: this.gameId
        });
    }

    /**
     * Check if connected
     */
    isConnected() {
        return this.socket && this.socket.connected;
    }
}