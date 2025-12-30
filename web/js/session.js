/**
 * Session Manager - Pure JavaScript
 * Replaces PHP session management
 * Uses memory storage (no localStorage due to artifact restrictions)
 */

class SessionManager {
    constructor() {
        this.data = {
            player_id: null,
            player_name: null,
            game_id: null,
            player_slot: null,
            joined_at: null,
            is_host: false
        };
    }

    /**
     * Set player information
     */
    setPlayer(playerId, playerName, gameId) {
        this.data.player_id = playerId;
        this.data.player_name = playerName;
        this.data.game_id = gameId;
        this.data.joined_at = Date.now();
        
        console.log('✅ Session set:', {
            player_id: playerId,
            player_name: playerName,
            game_id: gameId
        });
    }

    /**
     * Set player slot (assigned by server)
     */
    setPlayerSlot(slot) {
        this.data.player_slot = slot;
        console.log('✅ Player slot set:', slot);
    }

    /**
     * Set host status
     */
    setHost(isHost) {
        this.data.is_host = isHost;
    }

    /**
     * Check if player is in a game
     */
    isInGame() {
        return this.data.player_id && this.data.game_id;
    }

    /**
     * Get player ID
     */
    getPlayerId() {
        return this.data.player_id;
    }

    /**
     * Get player name
     */
    getPlayerName() {
        return this.data.player_name || 'Unknown';
    }

    /**
     * Get game ID
     */
    getGameId() {
        return this.data.game_id;
    }

    /**
     * Get player slot
     */
    getPlayerSlot() {
        return this.data.player_slot;
    }

    /**
     * Check if host
     */
    isHost() {
        return this.data.is_host;
    }

    /**
     * Get all session data
     */
    getData() {
        return { ...this.data };
    }

    /**
     * Clear session
     */
    clear() {
        console.log('🗑️ Clearing session');
        this.data = {
            player_id: null,
            player_name: null,
            game_id: null,
            player_slot: null,
            joined_at: null,
            is_host: false
        };
    }

    /**
     * Generate a unique player ID
     */
    static generatePlayerId() {
        return 'p_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    }

    /**
     * Generate a random game ID
     */
    static generateGameId() {
        let id = '';
        for (let i = 0; i < 4; i++) {
            id += Math.floor(Math.random() * 10);
        }
        return id;
    }
}

// Create global session instance
window.session = new SessionManager();