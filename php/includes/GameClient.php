<?php

namespace includes;

/**
 * GameClient.php (HTTP Version)
 * Handles communication with Socket.IO game server via HTTP API
 */
class GameClient
{
    private $serverUrl;
    private $timeout;

    public function __construct($host = '127.0.0.1', $port = 9999, $timeout = 5)
    {
        $this->serverUrl = "http://{$host}:{$port}";
        $this->timeout = $timeout;
    }

    /**
     * Send a command to the game engine via HTTP
     *
     * @param string $action The action to perform
     * @param array $params Parameters for the action
     * @param string|null $gameId Game ID (uses session if not provided)
     * @return array Response from server
     */
    public function sendCommand(string $action, array $params = [], string $gameId = null): array
    {
        // Use provided game_id or get from session
        if ($gameId === null) {
            $session = SessionManager::getInstance();
            $gameId = $session->getGameId() ?? 'default_game';
        }

        // Build request
        $request = [
            'action' => $action,
            'game_id' => $gameId,
            'params' => $params
        ];

        try {
            // Use cURL to send HTTP POST request
            $ch = curl_init($this->serverUrl . '/api/action');

            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => json_encode($request),
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => $this->timeout,
                CURLOPT_HTTPHEADER => [
                    'Content-Type: application/json',
                    'Accept: application/json'
                ]
            ]);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $error = curl_error($ch);
            curl_close($ch);

            if ($error) {
                return $this->errorResponse("Connection error: {$error}");
            }

            if ($httpCode !== 200) {
                return $this->errorResponse("Server returned HTTP {$httpCode}");
            }

            if (empty($response)) {
                return $this->errorResponse("Empty response from server");
            }

            $decoded = json_decode($response, true);

            if ($decoded === null) {
                return $this->errorResponse("Invalid JSON response: " . $response);
            }

            return $decoded;

        } catch (Exception $e) {
            return $this->errorResponse("Exception: " . $e->getMessage());
        }
    }

    /**
     * Quick method to get game state
     */
    public function getGameState($gameId = null)
    {
        if ($gameId === null) {
            $session = SessionManager::getInstance();
            $gameId = $session->getGameId() ?? 'default_game';
        }

        try {
            $ch = curl_init($this->serverUrl . '/api/state');

            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => json_encode(['game_id' => $gameId]),
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => $this->timeout,
                CURLOPT_HTTPHEADER => [
                    'Content-Type: application/json',
                    'Accept: application/json'
                ]
            ]);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $error = curl_error($ch);
            curl_close($ch);

            if ($error) {
                return $this->errorResponse("Connection error: {$error}");
            }

            if ($httpCode !== 200) {
                return $this->errorResponse("Server returned HTTP {$httpCode}");
            }

            $decoded = json_decode($response, true);

            if ($decoded === null) {
                return $this->errorResponse("Invalid JSON response");
            }

            return $decoded;

        } catch (Exception $e) {
            return $this->errorResponse("Exception: " . $e->getMessage());
        }
    }

    /**
     * Join a game
     */
    public function joinGame($gameId, $playerId, $playerName)
    {
        try {
            $ch = curl_init($this->serverUrl . '/api/join');

            $data = [
                'game_id' => $gameId,
                'player_id' => $playerId,
                'player_name' => $playerName
            ];

            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => json_encode($data),
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => $this->timeout,
                CURLOPT_HTTPHEADER => [
                    'Content-Type: application/json',
                    'Accept: application/json'
                ]
            ]);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $error = curl_error($ch);
            curl_close($ch);

            if ($error) {
                return $this->errorResponse("Connection error: {$error}");
            }

            if ($httpCode !== 200) {
                return $this->errorResponse("Server returned HTTP {$httpCode}");
            }

            $decoded = json_decode($response, true);

            if ($decoded === null) {
                return $this->errorResponse("Invalid JSON response");
            }

            return $decoded;

        } catch (Exception $e) {
            return $this->errorResponse("Exception: " . $e->getMessage());
        }
    }

    /**
     * Initialize a new game
     */
    public function initializeGame($gameId, $playerId, $playerName, $playerCount = 4)
    {
        return $this->sendCommand('initialize_game', [
            'game_id' => $gameId,
            'player_id' => $playerId,
            'player_name' => $playerName,
            'player_count' => $playerCount
        ], $gameId);
    }

    /**
     * Leave a game
     */
    public function leaveGame($gameId, $playerId): array
    {
        return $this->sendCommand('leave_game', [
            'player_id' => $playerId
        ], $gameId);
    }

    /**
     * Start the game
     */
    public function startGame($gameId, $settings = []): array
    {
        return $this->sendCommand("start_game", [
            'settings' => $settings
        ], $gameId);
    }

    /**
     * Buy shares
     */
    public function buyShares($player, $stock, $amount): array
    {
        return $this->sendCommand('buy_shares', [
            'player' => $player,
            'stock' => $stock,
            'amount' => $amount
        ]);
    }

    /**
     * Sell shares
     */
    public function sellShares($player, $stock, $amount): array
    {
        return $this->sendCommand('sell_shares', [
            'player' => $player,
            'stock' => $stock,
            'amount' => $amount
        ]);
    }

    /**
     * Roll dice
     */
    public function rollDice(): array
    {
        return $this->sendCommand('roll_dice', []);
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