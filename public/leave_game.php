<?php
/**
 * Leave Game Handler
 * Removes player from game and clears session
 * Location: /public/leave_game.php
 */

require_once '../includes/SessionManager.php';
require_once '../includes/GameClient.php';

$session = SessionManager::getInstance();
$client = new GameClient();

if ($session->isInGame()) {
    $gameId = $session->getGameId();
    $playerId = $session->getPlayerId();

    // Notify the game engine that player is leaving
    $response = $client->sendCommand('leave_game', [
        'player_id' => $playerId
    ], $gameId);

    // Always clear the session first
    $session->leaveGame();

    // Check if the game ended as a result of leaving
    if (isset($response['data']['game_over']) && $response['data']['game_over']) {
        // Game ended because all players left or only 1 remains
        // Redirect to game over screen (session is already cleared)
        header("Location: game_over.php?game_id=" . urlencode($gameId));
        exit;
    }
}

// Redirect to lobby
header("Location: index.php");
exit;