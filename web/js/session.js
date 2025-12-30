/**
 * Session Manager
 * Manages sessionStorage
 */

class SessionManager {
    /**
     * Set player information
     */
    static setPlayer(playerId, playerName, gameId) {
        window.sessionStorage.player_id = playerId;
        window.sessionStorage.player_name = playerName;
        window.sessionStorage.game_id = gameId;
        window.sessionStorage.joined_at = Date.now();
        
        console.log('✅ Session set:', {
            player_id: playerId,
            player_name: playerName,
            game_id: gameId
        });
    }

    /**
     * Set player slot (assigned by server)
     */
    static setPlayerSlot(slot) {
        window.sessionStorage.player_slot = slot;
        console.log('✅ Player slot set:', slot);
    }

    /**
     * Set host status
     */
    static setHost(isHost) {
        window.sessionStorage.is_host = isHost;
    }

    /**
     * Check if player is in a game
     */
    static isInGame() {
        return window.sessionStorage.player_id && window.sessionStorage.game_id;
    }

    /**
     * Get player ID
     */
    static getPlayerId() {
        return window.sessionStorage.player_id;
    }

    /**
     * Get player name
     */
    static getPlayerName() {
        return window.sessionStorage.player_name || 'Unknown';
    }

    /**
     * Get game ID
     */
    static getGameId() {
        return window.sessionStorage.game_id;
    }

    /**
     * Get player slot
     */
    static getPlayerSlot() {
        return window.sessionStorage.player_slot;
    }

    /**
     * Check if host
     */
    static isHost() {
        return window.sessionStorage.is_host;
    }

    /**
     * Get all session data
     */
    static getData() {
        return { ...window.sessionStorage };
    }

    /**
     * Clear session
     */
    static clear() {
        console.log('🗑️ Clearing session');
        window.sessionStorage.clear();
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