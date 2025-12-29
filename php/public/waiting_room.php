<?php

use includes\SessionManager;

require_once '../includes/SessionManager.php';
require_once '../includes/env_loader.php';

$session = SessionManager::getInstance();

// Redirect if not in game
if (!$session->isInGame()) {
    header("Location: index.php");
    exit;
}

// Get session data
$gameId = $session->getGameId();
$playerId = $session->getPlayerId();
$playerName = $session->getPlayerName();
$isFirstPlayer = $session->isFirstPlayer();

// Check for rejoin message
$rejoinMessage = '';
if (isset($_SESSION['rejoin_message'])) {
    $rejoinMessage = $_SESSION['rejoin_message'];
    unset($_SESSION['rejoin_message']);
}

// Check for rematch settings
$rematchSettings = $_SESSION['rematch_settings'] ?? null;
$hasRematchSettings = !empty($rematchSettings);
$playerCount = $_SESSION['player_count'] ?? 4;

// Default settings
$defaultMaxRounds = $rematchSettings['max_rounds'] ?? 15;
$defaultTradingDuration = $rematchSettings['trading_duration'] ?? 2;
$defaultDiceDuration = $rematchSettings['dice_duration'] ?? 15;
$defaultStartingCash = $rematchSettings['starting_cash'] ?? 5000;

// Get Socket.IO server URL from environment
$socketioServer = getenv('SOCKETIO_SERVER') ?: 'http://127.0.0.1:9999';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Waiting Room - Stock Ticker</title>
    <link rel="stylesheet" href="css/waiting_style.css">
    <script src="https://cdn.socket.io/4.6.0/socket.io.min.js"></script>
    <script>
        window.SOCKETIO_SERVER = '<?= $socketioServer ?>';
    </script>
    <script src="js/game_socketio.js"></script>
    <script src="js/waiting_room.js"></script>
</head>
<body>
<div class="page-wrapper">

    <div class="waiting-container">
        <div class="game-info">
            <h1>Waiting Room</h1>

            <?php if (!empty($rejoinMessage)): ?>
                <div class="status-message" style="background: #2ecc71; color: white; margin-bottom: 15px;">
                    🎮 <?= htmlspecialchars($rejoinMessage) ?>
                </div>
            <?php endif; ?>

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
                <h2>👥 Players (<span id="playerCount">0</span>/<?= $playerCount ?>)</h2>
                <div class="player-list" id="playerList">
                    <!-- Players will be populated by JavaScript -->
                    <div class="empty-slot">Connecting to game...</div>
                </div>
            </div>

            <div id="hostControls" style="display: none;">
                <!-- Hidden inputs for settings -->
                <input type="hidden" id="hidden_max_rounds" value="<?= $defaultMaxRounds ?>">
                <input type="hidden" id="hidden_trading_duration" value="<?= $defaultTradingDuration ?>">
                <input type="hidden" id="hidden_dice_duration" value="<?= $defaultDiceDuration ?>">
                <input type="hidden" id="hidden_starting_cash" value="<?= $defaultStartingCash ?>">

                <button id="startGameBtn" class="start-button" disabled onclick="startGame()">
                    ⛔ Need 2+ Players
                </button>
            </div>

            <div id="waitingMessage" style="text-align: center; padding: 20px; color: #333; font-style: italic; display: none;">
                ⏳ Waiting for host to start the game...
            </div>

            <div class="action-buttons" style="margin-top: 20px; text-align: center;">
                <a href="leave_game.php" class="btn-leave" onclick="return confirm('Leave the waiting room?')">Leave Game</a>
            </div>
        </div>
    </div>

    <aside class="host-sidebar" id="hostSidebar" style="display: none;">
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
                   name="max_rounds"
                   min="1" max="50"
                   value="<?= $defaultMaxRounds ?>"
                   class="retro-slider"
                   oninput="updateSetting('max_rounds', this.value)">
        </div>

        <div class="setting-group">
            <label>Trading Timer: <span id="val_trading"><?= $defaultTradingDuration ?></span> min</label>
            <input type="range"
                   id="range_trading_duration"
                   name="trading_duration"
                   min="1" max="10"
                   value="<?= $defaultTradingDuration ?>"
                   class="retro-slider"
                   oninput="updateSetting('trading_duration', this.value)">
        </div>

        <div class="setting-group">
            <label>Dice Timer: <span id="val_dice"><?= $defaultDiceDuration ?></span> sec</label>
            <input type="range"
                   id="range_dice_duration"
                   name="dice_duration"
                   min="0" max="30"
                   value="<?= $defaultDiceDuration ?>"
                   class="retro-slider"
                   oninput="updateSetting('dice_duration', this.value)">
        </div>

        <div class="setting-group">
            <label>Starting Cash: <span id="val_cash">$<?= number_format($defaultStartingCash) ?></span></label>
            <input type="range"
                   id="range_starting_cash"
                   name="starting_cash"
                   min="500" max="20000" step="500"
                   value="<?= $defaultStartingCash ?>"
                   class="retro-slider"
                   oninput="updateSetting('starting_cash', this.value)">
        </div>

        <button type="button" class="btn-reset" onclick="resetSettings()">↻ Reset Defaults</button>
    </aside>

</div>

<script>
    // Pass PHP data to JavaScript
    window.gameId = <?= json_encode($gameId) ?>;
    window.playerId = <?= json_encode($playerId) ?>;
    window.playerName = <?= json_encode($playerName) ?>;
    window.maxPlayers = <?= $playerCount ?>;
    window.isFirstPlayer = <?= $isFirstPlayer ? 'true' : 'false' ?>;
</script>
</body>
</html>