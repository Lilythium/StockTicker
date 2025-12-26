<?php
/**
 * Backend Test Script
 * Tests connection and commands to Python game engine
 */

use includes\GameClient;

require_once 'includes/GameClient.php';

header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html>
<head>
    <title>Backend Test</title>
    <style>
        body {
            font-family: monospace;
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 20px;
            line-height: 1.6;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
            background: #252526;
            padding: 30px;
            border-radius: 8px;
        }
        h1 { color: #4ec9b0; }
        h2 { color: #569cd6; margin-top: 30px; }
        .test {
            background: #1e1e1e;
            padding: 15px;
            margin: 15px 0;
            border-radius: 4px;
            border-left: 4px solid #569cd6;
        }
        .success {
            border-left-color: #4ec9b0;
        }
        .error {
            border-left-color: #f48771;
        }
        .test-title {
            font-weight: bold;
            margin-bottom: 10px;
        }
        pre {
            background: #0d0d0d;
            padding: 10px;
            border-radius: 4px;
            overflow-x: auto;
            color: #ce9178;
        }
        .status {
            font-weight: bold;
            margin-right: 10px;
        }
        .success .status { color: #4ec9b0; }
        .error .status { color: #f48771; }
    </style>
</head>
<body>
<div class="container">
    <h1>🐍 Python Backend Test</h1>

    <?php
    $client = new GameClient();
    $testGameId = 'test_game_' . time();

    // Test 1: Connection
    echo "<h2>Test 1: Connection</h2>";
    echo "<div class='test'>";
    echo "<div class='test-title'>Testing connection to Python backend...</div>";

    try {
        $socket = @socket_create(AF_INET, SOCK_STREAM, SOL_TCP);
        if ($socket === false) {
            echo "<div class='status error'>✗ Failed to create socket</div>";
        } else {
            $result = @socket_connect($socket, '127.0.0.1', 9999);

            if ($result === false) {
                echo "<div class='status error'>✗ Cannot connect to 127.0.0.1:9999</div>";
                echo "<p>Make sure Python backend is running: <code>python game_engine.py</code></p>";
            } else {
                echo "<div class='status success'>✓ Connected successfully!</div>";
                socket_close($socket);
            }
        }
    } catch (Exception $e) {
        echo "<div class='status error'>✗ Exception: " . $e->getMessage() . "</div>";
    }
    echo "</div>";

    // Test 2: Initialize Game
    echo "<h2>Test 2: Initialize Game</h2>";
    echo "<div class='test'>";
    echo "<div class='test-title'>Creating test game: {$testGameId}</div>";

    $response = $client->initializeGame($testGameId, 'p_test1', 'TestPlayer1', 4);

    if (isset($response['success']) && $response['success']) {
        echo "<div class='status success'>✓ Game initialized</div>";
        echo "<pre>" . json_encode($response, JSON_PRETTY_PRINT) . "</pre>";
    } else {
        echo "<div class='status error'>✗ Failed to initialize</div>";
        echo "<pre>" . json_encode($response, JSON_PRETTY_PRINT) . "</pre>";
    }
    echo "</div>";

    // Test 3: Add Second Player
    echo "<h2>Test 3: Add Second Player</h2>";
    echo "<div class='test'>";
    echo "<div class='test-title'>Joining with second player...</div>";

    $response = $client->joinGame($testGameId, 'p_test2', 'TestPlayer2');

    if (isset($response['success']) && $response['success']) {
        echo "<div class='status success'>✓ Second player joined</div>";
        echo "<pre>" . json_encode($response, JSON_PRETTY_PRINT) . "</pre>";
    } else {
        echo "<div class='status error'>✗ Failed to join</div>";
        echo "<pre>" . json_encode($response, JSON_PRETTY_PRINT) . "</pre>";
    }
    echo "</div>";

    // Test 4: Get Game State
    echo "<h2>Test 4: Get Game State</h2>";
    echo "<div class='test'>";
    echo "<div class='test-title'>Fetching game state...</div>";

    $response = $client->getGameState($testGameId);

    if (isset($response['success']) && $response['success']) {
        echo "<div class='status success'>✓ Game state retrieved</div>";
        $gameState = $response['data'] ?? [];
        echo "<p>Status: <strong>" . ($gameState['status'] ?? 'unknown') . "</strong></p>";
        echo "<p>Phase: <strong>" . ($gameState['current_phase'] ?? 'unknown') . "</strong></p>";

        if (isset($gameState['players'])) {
            $playerCount = 0;
            foreach ($gameState['players'] as $player) {
                if (isset($player['player_id']) && !empty($player['player_id'])) {
                    $playerCount++;
                }
            }
            echo "<p>Active Players: <strong>{$playerCount}</strong></p>";
        }

        echo "<details><summary>Full Response (click to expand)</summary>";
        echo "<pre>" . json_encode($response, JSON_PRETTY_PRINT) . "</pre>";
        echo "</details>";
    } else {
        echo "<div class='status error'>✗ Failed to get state</div>";
        echo "<pre>" . json_encode($response, JSON_PRETTY_PRINT) . "</pre>";
    }
    echo "</div>";

    // Test 5: Start Game
    echo "<h2>Test 5: Start Game</h2>";
    echo "<div class='test'>";
    echo "<div class='test-title'>Attempting to start game...</div>";

    $response = $client->startGame($testGameId);

    echo "<p>Response structure:</p>";
    echo "<pre>" . json_encode($response, JSON_PRETTY_PRINT) . "</pre>";

    if (isset($response['success'])) {
        if ($response['success']) {
            echo "<div class='status success'>✓ Game started!</div>";
        } else {
            echo "<div class='status error'>✗ Start failed</div>";
            echo "<p>Error: " . ($response['error'] ?? $response['data']['message'] ?? 'Unknown error') . "</p>";
        }
    } else {
        echo "<div class='status error'>✗ Invalid response format</div>";
        echo "<p>Response doesn't contain 'success' field</p>";
    }
    echo "</div>";

    // Test 6: Verify Game Started
    echo "<h2>Test 6: Verify Game Started</h2>";
    echo "<div class='test'>";
    echo "<div class='test-title'>Checking if game status changed to 'active'...</div>";

    $response = $client->getGameState($testGameId);

    if (isset($response['success']) && $response['success']) {
        $gameState = $response['data'] ?? [];
        $status = $gameState['status'] ?? 'unknown';

        if ($status === 'active') {
            echo "<div class='status success'>✓ Game status is now 'active'!</div>";
        } else {
            echo "<div class='status error'>✗ Game status is '{$status}' (expected 'active')</div>";
        }

        echo "<p>Current Status: <strong>{$status}</strong></p>";
        echo "<details><summary>Full State (click to expand)</summary>";
        echo "<pre>" . json_encode($gameState, JSON_PRETTY_PRINT) . "</pre>";
        echo "</details>";
    } else {
        echo "<div class='status error'>✗ Failed to get state</div>";
    }
    echo "</div>";

    // Summary
    echo "<h2>📊 Summary</h2>";
    echo "<div class='test'>";
    echo "<p>If all tests passed, your backend is working correctly!</p>";
    echo "<p>If Test 5 or 6 failed, there's an issue with the start_game command.</p>";
    echo "<p>Check your Python backend logs for more details.</p>";
    echo "</div>";
    ?>
</div>
</body>
</html>