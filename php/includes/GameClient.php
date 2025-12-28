<?php

namespace includes;

/**
 * GameClient.php (Socket.IO Version)
 * Simplified client - all game logic happens via Socket.IO in JavaScript
 * This class now only manages PHP sessions
 */
class GameClient
{
    private $serverUrl;

    public function __construct($host = '127.0.0.1', $port = 9999)
    {
        $this->serverUrl = "http://{$host}:{$port}";
    }

    /**
     * Get the Socket.IO server URL for JavaScript
     */
    public function getServerUrl(): string
    {
        return $this->serverUrl;
    }

    /**
     * All game actions are now handled by Socket.IO
     * These methods are kept for backwards compatibility but return placeholder responses
     */

    public function getGameState($gameId = null): array
    {
        // State is fetched via Socket.IO in JavaScript
        return [
            'success' => true,
            'data' => [
                'status' => 'waiting',
                'message' => 'Use Socket.IO for real-time state'
            ]
        ];
    }

    public function joinGame($gameId, $playerId, $playerName): array
    {
        // Join happens via Socket.IO
        return [
            'success' => true,
            'data' => [
                'player_id' => $playerId,
                'player_name' => $playerName,
                'message' => 'Join via Socket.IO'
            ]
        ];
    }

    public function initializeGame($gameId, $playerId, $playerName, $playerCount = 4): array
    {
        // Initialize happens via Socket.IO
        return [
            'success' => true,
            'data' => [
                'game_id' => $gameId,
                'player_id' => $playerId,
                'message' => 'Initialize via Socket.IO'
            ]
        ];
    }

    public function leaveGame($gameId, $playerId): array
    {
        return ['success' => true];
    }

    public function startGame($gameId, $settings = []): array
    {
        return ['success' => true];
    }

    public function sendCommand(string $action, array $params = [], string $gameId = null): array
    {
        return ['success' => true, 'message' => 'Use Socket.IO'];
    }

    /**
     * Helper to create error response
     */
    private function errorResponse($message): array
    {
        return [
            'success' => false,
            'error' => $message
        ];
    }
}