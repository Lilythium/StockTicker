<?php
require_once '../includes/SessionManager.php';
require_once '../includes/GameClient.php';

$session = SessionManager::getInstance();

if (isset($_GET['clear'])) {
    $session->leaveGame();
    header("Location: index.php");
    exit;
}

if ($session->isInGame()) {
    header("Location: waiting_room.php");
    exit;
}

$message = '';
$error = '';

// Check if this is a rematch with settings
$isRematch = isset($_GET['rematch']) && $_GET['rematch'] === '1';
$rematchSettings = null;
if ($isRematch) {
    $rematchSettings = [
            'max_rounds' => (int)($_GET['max_rounds'] ?? 15),
            'trading_duration' => (int)($_GET['trading_duration'] ?? 2),
            'dice_duration' => (int)($_GET['dice_duration'] ?? 15),
            'starting_cash' => (int)($_GET['starting_cash'] ?? 5000)
    ];
}

// Handle form submissions
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_POST['action']) && $_POST['action'] === 'join') {
        $playerName = trim($_POST['player_name']);
        $gameId = trim($_POST['game_id']);
        $playerCount = (int)($_POST['player_count'] ?? 4);

        if (empty($playerName)) {
            $error = 'Please enter your name';
        } elseif (empty($gameId)) {
            $error = 'Please enter a game ID';
        } elseif ($playerCount < 2 || $playerCount > 8) {
            $error = 'Player count must be between 2 and 8';
        } else {
            $playerId = 'p_' . substr(uniqid(), -8);
            $client = new GameClient();
            $stateResponse = $client->getGameState($gameId);

            if (!isset($stateResponse['success']) || !$stateResponse['success']) {
                $response = $client->initializeGame($gameId, $playerId, $playerName, $playerCount);
                $isFirstPlayer = true;
            } else {
                $response = $client->joinGame($gameId, $playerId, $playerName);
                $gameData = $stateResponse['data'] ?? [];
                $existingPlayerCount = 0;
                if (isset($gameData['players'])) {
                    foreach ($gameData['players'] as $player) {
                        if (!empty($player['player_id'])) {
                            $existingPlayerCount++;
                        }
                    }
                }
                $isFirstPlayer = ($existingPlayerCount == 0);
            }

            if (isset($response['success']) && $response['success']) {
                $serverAssignedName = $response['data']['player_name'] ?? $playerName;
                $session->setPlayer($playerId, $serverAssignedName, $gameId);
                $session->setFirstPlayer($isFirstPlayer);

                // Store rematch settings in session if this is a rematch
                if ($isRematch && $rematchSettings) {
                    $_SESSION['rematch_settings'] = $rematchSettings;
                }

                header("Location: waiting_room.php");
                exit;
            } else {
                $error = $response['error'] ?? 'Failed to join game. Please try again.';
            }
        }
    }
}

$digits = '';
for ($i = 0; $i < 4; $i++) {
    $digits .= mt_rand(0, 9);
}

$defaultGameId = isset($_GET['game']) ? htmlspecialchars($_GET['game']) : $digits;
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Stock Ticker - Lobby</title>
    <link rel="stylesheet" href="css/index_style.css">
</head>
<body>
<div class="lobby-container">
    <div class="lobby-header">
        <h1>Stock Ticker</h1>
        <?php if ($isRematch): ?>
            <p style="color: #3498db; font-size: 14px; margin-top: 10px;">
                🔄 Rematch Mode - Settings from previous game will be applied!
            </p>
        <?php endif; ?>
    </div>

    <?php if (!empty($error)): ?>
        <div class="message error">
            ⚠️ <?= htmlspecialchars($error) ?>
        </div>
    <?php endif; ?>

    <div class="lobby-option">
        <h2>Player Registration</h2>
        <form method="POST">
            <input type="hidden" name="action" value="join">

            <div class="form-group">
                <label for="player_name">Name</label>
                <input type="text"
                       id="player_name"
                       name="player_name"
                       placeholder="TYPE NAME HERE..."
                       required
                       maxlength="20"
                       autofocus>
            </div>

            <div class="form-group">
                <label for="game_id">Game ID</label>
                <div class="input-wrapper">
                    <input type="text"
                           id="game_id"
                           name="game_id"
                           value="<?= $defaultGameId ?>"
                           required
                           maxlength="30">
                    <span class="input-icon" onclick="generateGameId()" title="Roll for Random ID">🎲</span>
                </div>
            </div>

            <button type="submit" class="btn-primary">
                <?= $isRematch ? '🔄 Join Rematch' : 'Join / Create Game' ?>
            </button>
        </form>
    </div>

    <div class="lobby-option">
        <div class="info-box">
            <h2>Rules</h2>
            <ul>
                <li><strong>2-4 Players</strong> compete for profit.</li>
                <li>Start with <strong>$5,000</strong> cash on hand.</li>
                <li>Trade in <strong>blocks of 500 shares</strong>.</li>
                <li>Markets move based on <strong>dice rolls</strong>.</li>
            </ul>
        </div>
    </div>
</div>

<script>
    function generateGameId() {
        const chars = '0123456789';
        let gameId = '';
        for (let i = 0; i < 4; i++) {
            gameId += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        document.getElementById('game_id').value = gameId;
    }
</script>
</body>
</html>