<?php
/**
 * Full game state retrieval for JavaScript
 * Returns complete game state including dice results
 * Location: /public/get_game_state.php
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

    echo json_encode($response);

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}