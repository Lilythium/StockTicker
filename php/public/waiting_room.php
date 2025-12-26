<?php

use includes\GameClient;
use includes\SessionManager;

require_once '../includes/SessionManager.php';
require_once '../includes/GameClient.php';

$session = SessionManager::getInstance();

if (!$session->isInGame()) {
    header("Location: index.php");
    exit;
}

if ($session->isSessionExpired()) {
    $session->leaveGame();
    header("Location: index.php?error=session_expired");
    exit;
}

$gameId = $session->getGameId();
$playerId = $session->getPlayerId();
$playerName = $session->getPlayerName();
$isFirstPlayer = $session->isFirstPlayer();

$client = new GameClient();
$response = $client->getGameState($gameId);
$gameState = $response['data'] ?? [];

// Check if game is over
if (isset($gameState['game_over']) && $gameState['game_over']) {
    header("Location: game_over.php?game_id=" . urlencode($gameId));
    exit;
}

// Check if game has started
if (isset($gameState['status']) && $gameState['status'] === 'active') {
    header("Location: game.php");
    exit;
}

// Check for rematch settings in session
$rematchSettings = $_SESSION['rematch_settings'] ?? null;
$hasRematchSettings = !empty($rematchSettings);

$playerCount = 0;
if (isset($gameState['players'])) {
    foreach ($gameState['players'] as $player) {
        if (!empty($player['player_id'])) {
            $playerCount++;
        }
    }
}

$maxPlayers = $gameState['player_count'] ?? 4;
$canStart = $playerCount >= 2 && $isFirstPlayer;

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'start_game') {
    if ($isFirstPlayer) {
        // Collect settings from the form
        $settings = [
                'max_rounds' => (int)($_POST['max_rounds'] ?? 15),
                'trading_duration' => (int)($_POST['trading_duration'] ?? 2),
                'dice_duration' => (int)($_POST['dice_duration'] ?? 15),
                'starting_cash' => (int)($_POST['starting_cash'] ?? 5000)
        ];

        $result = $client->startGame($gameId, $settings);

        if ($result['success']) {
            // Clear rematch settings after using them
            unset($_SESSION['rematch_settings']);
            header("Location: game.php");
            exit;
        } else {
            $error = $result['error'] ?? "Failed to start game";
        }
    }
}

// Default settings
$defaultMaxRounds = $rematchSettings['max_rounds'] ?? 15;
$defaultTradingDuration = $rematchSettings['trading_duration'] ?? 2;
$defaultDiceDuration = $rematchSettings['dice_duration'] ?? 15;
$defaultStartingCash = $rematchSettings['starting_cash'] ?? 5000;
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Waiting Room - Stock Ticker</title>
    <link rel="stylesheet" href="css/waiting_style.css">
</head>
<body>
<div class="page-wrapper">

    <div class="waiting-container">
        <div class="game-info">
            <h1>Waiting Room</h1>

            <div class="game-id-display">
                <div class="game-id-label">Game ID</div>
                <div class="game-id-value"><?= htmlspecialchars($gameId) ?></div>
            </div>

            <div class="share-link">
                <p><strong>📋 Share this link with friends:</strong></p>
                <div class="copy-link">
                    <?php
                    $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http";
                    $host = $_SERVER['HTTP_HOST'];
                    $baseUrl = dirname($_SERVER['PHP_SELF']);
                    $shareLink = $protocol . "://" . $host . $baseUrl . "/index.php?game=" . urlencode($gameId);
                    ?>
                    <input type="text" id="gameLink" value="<?= htmlspecialchars($shareLink) ?>" readonly>
                    <button class="copy-button" id="copyButton" onclick="copyGameLink()">Copy</button>
                </div>
            </div>

            <div class="players-waiting">
                <h2>👥 Players (<span id="playerCount"><?= $playerCount ?></span>/<?= $maxPlayers ?>)</h2>
                <div class="player-list">
                    <?php
                    $slotsFilled = 0;
                    if (isset($gameState['players'])):
                        foreach ($gameState['players'] as $slot => $player):
                            if (!empty($player['player_id'])):
                                $slotsFilled++;
                                $isYou = $player['player_id'] === $playerId;

                                if ($isYou && $player['name'] !== $playerName) {
                                    $_SESSION['player_name'] = $player['name'];
                                    $playerName = $player['name'];
                                }

                                $isHost = $slotsFilled === 1;
                                $itemClass = 'player-item' . ($isYou ? ' you' : '') . ($isHost ? ' host' : '');
                                ?>
                                <div class="<?= $itemClass ?>">
                                    <div class="player-name">
                                        <?= htmlspecialchars($player['name']) ?>
                                        <?php if ($isYou): ?><span class="player-badge you">You</span><?php endif; ?>
                                        <?php if ($isHost): ?><span class="player-badge host">Host</span><?php endif; ?>
                                    </div>
                                    <div style="font-weight: bold;">Ready ✅</div>
                                </div>
                            <?php endif; endforeach; endif; ?>

                    <?php for ($i = $slotsFilled; $i < $maxPlayers; $i++): ?>
                        <div class="empty-slot">Waiting for player...</div>
                    <?php endfor; ?>
                </div>
            </div>

            <?php if ($isFirstPlayer): ?>
                <form method="POST" id="startGameForm" onsubmit="return confirmStart()">
                    <input type="hidden" name="action" value="start_game">

                    <!-- Hidden inputs to capture settings -->
                    <input type="hidden" name="max_rounds" id="hidden_max_rounds" value="<?= $defaultMaxRounds ?>">
                    <input type="hidden" name="trading_duration" id="hidden_trading_duration" value="<?= $defaultTradingDuration ?>">
                    <input type="hidden" name="dice_duration" id="hidden_dice_duration" value="<?= $defaultDiceDuration ?>">
                    <input type="hidden" name="starting_cash" id="hidden_starting_cash" value="<?= $defaultStartingCash ?>">

                    <button type="submit" class="start-button" <?= !$canStart ? 'disabled' : '' ?>>
                        <?= $canStart ? 'Start Game' : '⛔ Need 2+ Players' ?>
                    </button>
                </form>

            <?php else: ?>
                <div style="text-align: center; padding: 20px; color: #333; font-style: italic;">
                    ⏳ Waiting for host to start the game...
                </div>
            <?php endif; ?>

            <div class="action-buttons" style="margin-top: 20px; text-align: center;">
                <a href="leave_game.php" class="btn-leave" onclick="return confirm('Leave the waiting room?')">Leave Game</a>
            </div>
        </div>
    </div>

    <?php if ($isFirstPlayer): ?>
        <aside class="host-sidebar">
            <div class="sidebar-header">
                <h3>⚙️ GAME SETTINGS</h3>
                <?php if ($hasRematchSettings): ?>
                    <p style="font-size: 12px; color: #27ae60; margin: 5px 0 0 0;">🔄 Rematch settings loaded!</p>
                <?php endif; ?>
            </div>

            <div class="setting-group">
                <label>Max Rounds: <span id="val_rounds"><?= $defaultMaxRounds ?></span></label>
                <input type="range"
                       id="range_max_rounds"
                       min="1" max="50"
                       value="<?= $defaultMaxRounds ?>"
                       class="retro-slider"
                       oninput="updateSetting('max_rounds', this.value)">
            </div>

            <div class="setting-group">
                <label>Trading Timer: <span id="val_trading"><?= $defaultTradingDuration ?></span> min</label>
                <input type="range"
                       id="range_trading_duration"
                       min="1" max="10"
                       value="<?= $defaultTradingDuration ?>"
                       class="retro-slider"
                       oninput="updateSetting('trading_duration', this.value)">
            </div>

            <div class="setting-group">
                <label>Dice Timer: <span id="val_dice"><?= $defaultDiceDuration ?></span> sec</label>
                <input type="range"
                       id="range_dice_duration"
                       min="0" max="30"
                       value="<?= $defaultDiceDuration ?>"
                       class="retro-slider"
                       oninput="updateSetting('dice_duration', this.value)">
                <br><small>0 = instant auto-roll</small>
            </div>

            <div class="setting-group">
                <label>Starting Cash: <span id="val_cash">$<?= number_format($defaultStartingCash) ?></span></label>
                <input type="range"
                       id="range_starting_cash"
                       min="500" max="20000" step="500"
                       value="<?= $defaultStartingCash ?>"
                       class="retro-slider"
                       oninput="updateSetting('starting_cash', this.value)">
            </div>

            <button type="button" class="btn-reset" onclick="resetSettings()">↻ Reset Defaults</button>
        </aside>
    <?php endif; ?>

</div>

<script>
    window.gameId = <?= json_encode($gameId) ?>;
    window.playerId = <?= json_encode($playerId) ?>;
    window.isFirstPlayer = <?= $isFirstPlayer ? 'true' : 'false' ?>;

    // Function to update hidden form inputs and display
    function updateSetting(name, value) {
        // Update hidden input
        const hiddenInput = document.getElementById('hidden_' + name);
        if (hiddenInput) {
            hiddenInput.value = value;
        }

        // Update display
        if (name === 'max_rounds') {
            document.getElementById('val_rounds').innerText = value;
        } else if (name === 'trading_duration') {
            document.getElementById('val_trading').innerText = value;
        } else if (name === 'dice_duration') {
            document.getElementById('val_dice').innerText = value;
        } else if (name === 'starting_cash') {
            document.getElementById('val_cash').innerText = '$' + Number(value).toLocaleString();
        }
    }

    function resetSettings() {
        const defaults = {
            'max_rounds': 15,
            'trading_duration': 2,
            'dice_duration': 15,
            'starting_cash': 5000
        };

        for (const [name, value] of Object.entries(defaults)) {
            const rangeInput = document.getElementById('range_' + name);
            if (rangeInput) {
                rangeInput.value = value;
                updateSetting(name, value);
            }
        }
    }
</script>
<script src="js/waiting_room.js"></script>
</body>
</html>