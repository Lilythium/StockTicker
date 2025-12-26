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
$stateResponse = $client->getGameState($gameId);
$gameState = $stateResponse['data'] ?? [];
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
    'player' => (int)$playerSlot,
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

    // Check for errors
    if (isset($response['error']) && $response['error']) {
        echo json_encode(['success' => false, 'error' => $response['error']]);
        exit;
    }

    if (!isset($response['success']) || !$response['success']) {
        echo json_encode(['success' => false, 'error' => 'Action failed']);
        exit;
    }

    // Handle roll_dice specifically
    if ($action === 'roll_dice') {
        $rollData = $response['data'] ?? [];

        // Check if dice data exists
        if (isset($rollData['dice'])) {
            // New format: dice data in 'dice' key
            $diceInfo = $rollData['dice'];
            echo json_encode([
                'success' => true,
                'data' => [
                    'stock' => $diceInfo['stock'] ?? '',
                    'action' => $diceInfo['action'] ?? '',
                    'amount' => $diceInfo['amount'] ?? 0
                ]
            ]);
        } else {
            // Fallback: return success but no dice data
            // JS will wait for poller to catch it
            echo json_encode([
                'success' => true,
                'data' => []
            ]);
        }
    } else {
        // Standard success for Buy/Sell/Done
        echo json_encode([
            'success' => true,
            'message' => 'Action completed successfully'
        ]);
    }

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}