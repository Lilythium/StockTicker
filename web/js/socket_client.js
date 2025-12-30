/**
 * Enhanced Socket.IO Client
 * Handles all communication with Python backend
 */

class GameSocket {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        // Event callbacks
        this.onStateUpdate = null;
        this.onDiceRolled = null;
        this.onPhaseChanged = null;
        this.onGameOver = null;
        this.onGameStarted = null;
        this.onError = null;
        this.onConnectionChange = null;
        
        this.initSocket();
    }

    /**
     * Initialize Socket.IO connection
     */
    initSocket() {
        console.log('🔌 Initializing Socket.IO...');
        
        this.socket = io(window.APP_CONFIG.SOCKETIO_SERVER, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: this.maxReconnectAttempts,
            autoConnect: false
        });

        this.setupEventHandlers();
    }

    /**
     * Setup all Socket.IO event handlers
     */
    setupEventHandlers() {
        // Connection events
        this.socket.on('connect', () => {
            console.log('✅ Connected to server');
            this.connected = true;
            this.reconnectAttempts = 0;
            
            if (this.onConnectionChange) {
                this.onConnectionChange(true);
            }
            
            // Rejoin game if we have session data
            if (SessionManager.isInGame()) {
                this.rejoinGame();
            }
        });

        this.socket.on('disconnect', (reason) => {
            console.log('❌ Disconnected:', reason);
            this.connected = false;
            
            if (this.onConnectionChange) {
                this.onConnectionChange(false);
            }
        });

        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            this.reconnectAttempts++;
            
            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                if (this.onError) {
                    this.onError('Failed to connect to server. Please refresh.');
                }
            }
        });

        // Game events
        this.socket.on('join_result', (data) => this.handleJoinResult(data));
        this.socket.on('game_state_update', (state) => this.handleStateUpdate(state));
        this.socket.on('dice_rolled', (data) => this.handleDiceRolled(data));
        this.socket.on('phase_transition', (data) => this.handlePhaseTransition(data));
        this.socket.on('game_started', (data) => this.handleGameStarted(data));
        this.socket.on('game_over', (data) => this.handleGameOver(data));
        this.socket.on('error', (data) => this.handleError(data));
    }

    /**
     * Connect to server
     */
    connect() {
        if (!this.socket.connected) {
            console.log('🔌 Connecting...');
            this.socket.connect();
        }
    }

    /**
     * Disconnect from server
     */
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }

    /**
     * Join a game
     */
    joinGame(gameId, playerId, playerName, playerCount = 4) {
        console.log('📥 Joining game:', { gameId, playerId, playerName });
        
        this.socket.emit('join_game', {
            game_id: gameId,
            player_id: playerId,
            player_name: playerName,
            player_count: playerCount
        });
    }

    /**
     * Rejoin game after disconnect
     */
    rejoinGame() {
        const gameId = SessionManager.getGameId();
        const playerId = SessionManager.getPlayerId();
        const playerName = SessionManager.getPlayerName();
        
        if (gameId && playerId) {
            console.log('🔄 Rejoining game...');
            this.joinGame(gameId, playerId, playerName);
        }
    }

    /**
     * Leave game
     */
    leaveGame() {
        const gameId = SessionManager.getGameId();
        const playerId = SessionManager.getPlayerId();
        
        if (gameId && playerId) {
            this.socket.emit('leave_game', {
                game_id: gameId,
                player_id: playerId
            });
        }
    }

    /**
     * Start game
     */
    startGame(settings) {
        const gameId = SessionManager.getGameId();
        
        this.socket.emit('start_game', {
            game_id: gameId,
            settings: settings
        });
    }

    /**
     * Buy shares
     */
    buyShares(stock, amount) {
        const gameId = SessionManager.getGameId();
        const playerSlot = SessionManager.getPlayerSlot();
        
        this.socket.emit('buy_shares', {
            game_id: gameId,
            player: playerSlot,
            stock: stock,
            amount: amount
        });
    }

    /**
     * Sell shares
     */
    sellShares(stock, amount) {
        const gameId = SessionManager.getGameId();
        const playerSlot = SessionManager.getPlayerSlot();
        
        this.socket.emit('sell_shares', {
            game_id: gameId,
            player: playerSlot,
            stock: stock,
            amount: amount
        });
    }

    /**
     * Mark done trading
     */
    markDoneTrading() {
        const gameId = SessionManager.getGameId();
        const playerSlot = SessionManager.getPlayerSlot();
        
        this.socket.emit('done_trading', {
            game_id: gameId,
            player: playerSlot
        });
    }

    /**
     * Roll dice
     */
    rollDice() {
        const gameId = SessionManager.getGameId();
        const playerSlot = SessionManager.getPlayerSlot();
        
        this.socket.emit('roll_dice', {
            game_id: gameId,
            player: playerSlot
        });
    }

    /**
     * Request current state
     */
    requestState() {
        const gameId = SessionManager.getGameId();
        
        this.socket.emit('get_state', {
            game_id: gameId
        });
    }

    // Event Handlers
    handleJoinResult(data) {
        console.log('📥 Join result:', data);
        
        if (data.success && data.game_state) {
            const state = data.game_state;
            
            // Set player slot from server response
            const playerId = SessionManager.getPlayerId();
            if (state.players) {
                for (const [slot, player] of Object.entries(state.players)) {
                    if (player.player_id === playerId) {
                        SessionManager.setPlayerSlot(parseInt(slot));
                        break;
                    }
                }
            }
            
            // Check if host
            if (state.host_player_id === playerId) {
                SessionManager.setHost(true);
            }
            
            this.handleStateUpdate(state);
        }
    }

    handleStateUpdate(state) {
        if (this.onStateUpdate) {
            this.onStateUpdate(state);
        }
    }

    handleDiceRolled(data) {
        if (this.onDiceRolled) {
            this.onDiceRolled(data);
        }
    }

    handlePhaseTransition(data) {
        console.log('🔄 Phase transition:', data);
        if (this.onPhaseChanged) {
            this.onPhaseChanged(data);
        }
    }

    handleGameStarted(data) {
        console.log('🎮 Game started!');
        if (this.onGameStarted) {
            this.onGameStarted(data);
        }
    }

    handleGameOver(data) {
        console.log('🏁 Game over:', data);
        if (this.onGameOver) {
            this.onGameOver(data);
        }
    }

    handleError(data) {
        console.error('❌ Server error:', data);
        if (this.onError) {
            this.onError(data.message || 'An error occurred');
        }
    }
}

// Create global socket instance
window.gameSocket = new GameSocket();