<?php
/**
 * Lightweight state checker for AJAX polling
 * Returns minimal info + dice results + auto_roll_needed flag
 * Location: /public/check_state.php
 */

// Get the correct path to includes
$includePath = dirname(__FILE__) . '/../includes/';

require_once $includePath . 'SessionManager.php';
require_once $includePath . 'GameClient.php';

header('Content-Type: application/json');

// Disable caching
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Cache-Control: post-check=0, pre-check=0', false);
header('Pragma: no-cache');

$session = SessionManager::getInstance();
$gameId = $_GET['game_id'] ?? $session->getGameId();

if (!$gameId) {
    echo json_encode(['success' => false, 'error' => 'No game_id provided']);
    exit;
}

try {
    $client = new GameClient();
    $response = $client->getGameState($gameId);

    // Check if response is valid
    if (!isset($response['success']) || !$response['success']) {
        echo json_encode([
            'success' => false,
            'error' => 'Failed to get game state'
        ]);
        exit;
    }

    $gameState = $response['data'] ?? [];

    // Return key fields that indicate state changes
    $stateSnapshot = [
        'success' => true,
        'phase' => $gameState['current_phase'] ?? 'trading',
        'turn' => $gameState['current_turn'] ?? 0,
        'round' => $gameState['current_round'] ?? 1,
        'done_count' => $gameState['done_trading_count'] ?? 0,
        'active_players' => $gameState['active_player_count'] ?? 0,
        'time_remaining' => (int)($gameState['time_remaining'] ?? 0),
        'data' => [
            'dice_results' => $gameState['dice_results'] ?? null,
            'stocks' => $gameState['stocks'] ?? [],
            'game_over' => $gameState['game_over'] ?? false,
            'auto_roll_needed' => $gameState['auto_roll_needed'] ?? false,
            'trading_complete' => $gameState['trading_complete'] ?? false
        ]
    ];

    echo json_encode($stateSnapshot);

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}