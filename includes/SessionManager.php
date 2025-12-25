<?php
/**
 * SessionManager.php
 * Handles player sessions and game state tracking
 */

class SessionManager {
    private static $instance = null;

    private function __construct() {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
    }

    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Set player information and join a game
     */
    public function setPlayer($playerId, $playerName, $gameId) {
        $_SESSION['player_id'] = $playerId;
        $_SESSION['player_name'] = $playerName;
        $_SESSION['game_id'] = $gameId;
        $_SESSION['joined_at'] = time();
    }

    /**
     * Check if player is in a game
     */
    public function isInGame(): bool
    {
        return isset($_SESSION['player_id']) &&
            !empty($_SESSION['game_id']);
    }

    /**
     * Get current game ID
     */
    public function getGameId() {
        return $_SESSION['game_id'] ?? null;
    }

    /**
     * Get current player ID
     */
    public function getPlayerId() {
        return $_SESSION['player_id'] ?? null;
    }

    /**
     * Get current player name
     */
    public function getPlayerName() {
        return $_SESSION['player_name'] ?? 'Unknown Player';
    }

    /**
     * Get when player joined
     */
    public function getJoinedAt() {
        return $_SESSION['joined_at'] ?? null;
    }

    /**
     * Check if this player is the first to join
     */
    public function isFirstPlayer() {
        return $_SESSION['is_first_player'] ?? false;
    }

    /**
     * Mark this player as first
     */
    public function setFirstPlayer($isFirst = true) {
        $_SESSION['is_first_player'] = $isFirst;
    }

    /**
     * Destroy entire session
     */
    public function destroy() {
        session_destroy();
    }

    /**
     * Get all session data (for debugging)
     */
    public function getSessionData() {
        return [
            'game_id' => $this->getGameId(),
            'player_id' => $this->getPlayerId(),
            'player_name' => $this->getPlayerName(),
            'joined_at' => $this->getJoinedAt(),
            'is_first_player' => $this->isFirstPlayer()
        ];
    }

    public function isSessionExpired() {
        if (!isset($_SESSION['joined_at'])) {
            return true;
        }

        $timeout = 3600; // 1 hour
        return (time() - $_SESSION['joined_at']) > $timeout;
    }

    public function setDoneTrading($done = true) {
        $_SESSION['done_trading'] = $done;
        $_SESSION['done_trading_time'] = time();
    }

    public function isDoneTrading() {
        return $_SESSION['done_trading'] ?? false;
    }

    public function resetDoneTrading() {
        unset($_SESSION['done_trading']);
        unset($_SESSION['done_trading_time']);
    }

    // Update the leaveGame method to also reset done trading
    public function leaveGame() {
        unset($_SESSION['game_id']);
        unset($_SESSION['player_id']);
        unset($_SESSION['player_name']);
        unset($_SESSION['joined_at']);
        unset($_SESSION['done_trading']);
        unset($_SESSION['done_trading_time']);
    }
}
