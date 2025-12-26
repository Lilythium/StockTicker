<?php
/**
 * game_action.php
 * Handles Buy, Sell, Roll, and Done Trading logic
 */
require_once '../../includes/SessionManager.php';
require_once '../../includes/GameClient.php';

header('Content-Type: application/json');

// 1. Validate Session
$session = SessionManager::getInstance();
if (!$session->isInGame()) {
    echo json_encode(['success' => false, 'error' => 'Not in game']);
    exit;
}

$gameId = $session->getGameId();
$playerId = $session->getPlayerId();
$client = new GameClient();

// 2. Validate Request
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Invalid request method']);
    exit;
}

$action = $_POST['action'] ?? '';

// 3. Get Current Player Slot
// We need to know which slot (0, 1, 2, 3) the current player is in
$stateParams = $client->getGameState($gameId);
$gameState = $stateParams['data'] ?? [];
$playerSlot = null;

if (isset($gameState['players'])) {
    foreach ($gameState['players'] as $slot => $p) {
        if (($p['player_id'] ?? '') === $playerId) {
            $playerSlot = $slot;
            break;
        }
    }
}

if ($playerSlot === null) {
    echo json_encode(['success' => false, 'error' => 'Player not found in game state']);
    exit;
}

// 4. Prepare Parameters
$params = [
    'player' => (int)$playerSlot, // The game engine expects the slot number
    'game_id' => $gameId
];

// Add specific fields based on action
if ($action === 'buy_shares' || $action === 'sell_shares') {
    $params['stock'] = $_POST['stock'] ?? '';
    $params['amount'] = (int)($_POST['amount'] ?? 0);

    if ($params['amount'] <= 0) {
        echo json_encode(['success' => false, 'error' => 'Invalid amount']);
        exit;
    }
}

// 5. Send to Game Engine
try {
    $response = $client->sendCommand($action, $params);

    // 1. Check for explicit errors first
    if (isset($response['error']) && $response['error']) {
        echo json_encode(['success' => false, 'error' => $response['error']]);
        exit;
    }

    // 2. Identify where the dice data lives
    // Some engines return it in $response['data'], others in $response['result']
    $dataContainer = $response['data'] ?? $response['result'] ?? [];

    if ($action === 'roll_dice') {
        // Log the response to your server error log to see the real structure if this fails
        // error_log("Roll Response: " . print_r($response, true));

        echo json_encode([
            'success' => true,
            'data' => [
                'stock'  => $dataContainer['stock']  ?? '',
                'action' => $dataContainer['action'] ?? '',
                'amount' => $dataContainer['amount'] ?? 0
            ]
        ]);
    } else {
        // Standard success for Buy/Sell/Done
        echo json_encode(['success' => true]);
    }

} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}