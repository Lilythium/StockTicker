<?php
/**
 * GameClient.php
 * Handles communication with Python game engine via sockets
 */

class GameClient {
    private $host;
    private $port;
    private $timeout;

    public function __construct($host = '127.0.0.1', $port = 9999, $timeout = 5) {
        $this->host = $host;
        $this->port = $port;
        $this->timeout = $timeout;
    }

    /**
     * Send a command to the game engine
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
            $gameId = $session->getGameId() ?? GAME_ID;
        }

        // Build request
        $request = [
            'action' => $action,
            'game_id' => $gameId,
            'params' => $params
        ];

        try {
            // Create socket connection
            $socket = socket_create(AF_INET, SOCK_STREAM, SOL_TCP);

            if ($socket === false) {
                return $this->errorResponse("Failed to create socket: " . socket_strerror(socket_last_error()));
            }

            // Set timeout
            socket_set_option($socket, SOL_SOCKET, SO_RCVTIMEO, ['sec' => $this->timeout, 'usec' => 0]);
            socket_set_option($socket, SOL_SOCKET, SO_SNDTIMEO, ['sec' => $this->timeout, 'usec' => 0]);

            // Connect
            $result = @socket_connect($socket, $this->host, $this->port);

            if ($result === false) {
                socket_close($socket);
                return $this->errorResponse("Failed to connect to game engine. Is it running?");
            }

            // Send request
            $jsonRequest = json_encode($request) . "\n";
            socket_write($socket, $jsonRequest, strlen($jsonRequest));

            // Read response
            $response = '';
            while ($chunk = socket_read($socket, 2048)) {
                $response .= $chunk;
                if (strlen($chunk) < 2048) {
                    break;
                }
            }

            socket_close($socket);

            // Parse response
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
    public function getGameState($gameId = null) {
        return $this->sendCommand('get_game_state', [], $gameId);
    }

    /**
     * Join a game
     */
    public function joinGame($gameId, $playerId, $playerName) {
        return $this->sendCommand('join_game', [
            'game_id' => $gameId,
            'player_id' => $playerId,
            'player_name' => $playerName
        ], $gameId);
    }

    /**
     * Initialize a new game
     */
    public function initializeGame($gameId, $playerId, $playerName, $playerCount = 4) {
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
        ]);
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