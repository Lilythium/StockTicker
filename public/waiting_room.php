<?php
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

// Handle start game action
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    if ($_POST['action'] === 'start_game' && $isFirstPlayer) {
        $settings = [
                'max_rounds'       => (int)($_POST['max_rounds'] ?? 15),
                'trading_duration' => (int)($_POST['trading_duration'] ?? 2),
                'dice_duration'    => (int)($_POST['dice_duration'] ?? 15),
                'starting_cash'    => (int)($_POST['starting_cash'] ?? 5000)
        ];

        unset($_SESSION['rematch_settings']);
        $startResponse = $client->startGame($gameId, $settings);

        if (isset($startResponse['success']) && $startResponse['success']) {
            header("Location: game.php");
            exit;
        } else {
            $error = $startResponse['error'] ?? $startResponse['data']['message'] ?? 'Failed to start game';
        }
    }
}

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
<div class="page-wrapper" style="display: flex; justify-content: center; gap: 20px; padding: 20px;">

    <div class="waiting-container">
        <div class="game-info">
            <h1>Waiting Room</h1>

            <div class="game-id-display">
                <div class="game-id-label">Game ID</div>
                <div class="game-id-value"><?= htmlspecialchars($gameId) ?></div>
            </div>

            <?php if (isset($error)): ?>
                <div class="message error">⚠️ <?= htmlspecialchars($error) ?></div>
            <?php endif; ?>

            <div class="share-link">
                <p><strong>📋 Share this link with friends:</strong></p>
                <div class="copy-link" style="display: flex; gap: 5px;">
                    <?php
                    $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http";
                    $host = $_SERVER['HTTP_HOST'];
                    $baseUrl = dirname($_SERVER['PHP_SELF']);
                    $shareLink = $protocol . "://" . $host . $baseUrl . "/index.php?game=" . urlencode($gameId);
                    ?>
                    <input type="text" id="gameLink" value="<?= htmlspecialchars($shareLink) ?>" readonly style="flex-grow: 1;">
                    <button class="copy-button" id="copyButton" onclick="copyGameLink()">Copy</button>
                </div>
            </div>

            <div class="players-waiting">
                <h2>👥 Players (<?= $playerCount ?>/<?= $maxPlayers ?>)</h2>
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
                                <div class="<?= $itemClass ?>" style="display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #ccc;">
                                    <div class="player-name">
                                        <?= htmlspecialchars($player['name']) ?>
                                        <?php if ($isYou): ?><span class="player-badge you">You</span><?php endif; ?>
                                        <?php if ($isHost): ?><span class="player-badge host">Host</span><?php endif; ?>
                                    </div>
                                    <div style="font-weight: bold;">Ready ✅</div>
                                </div>
                            <?php endif; endforeach; endif; ?>

                    <?php for ($i = $slotsFilled; $i < $maxPlayers; $i++): ?>
                        <div class="empty-slot" style="padding: 10px; font-style: italic; color: #888;">Waiting for player...</div>
                    <?php endfor; ?>
                </div>
            </div>

            <?php if ($isFirstPlayer): ?>
                <form method="POST" id="startGameForm" onsubmit="return confirmStart()">
                    <input type="hidden" name="action" value="start_game">
                    <button type="submit" class="start-button" <?= !$canStart ? 'disabled' : '' ?> style="width: 100%; padding: 15px; margin-top: 20px;">
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

            <div style="text-align: center; margin-top: 20px; color: #333; font-size: 14px;">
                <label style="cursor: pointer;">
                    <input type="checkbox" id="autoRefresh" checked onchange="toggleAutoRefresh()">
                    Auto-refresh (every 3 seconds)
                </label>
            </div>
        </div>
    </div>

    <?php if ($isFirstPlayer): ?>
        <aside class="host-sidebar" style="width: 250px; background: #f9f9f9; padding: 20px; border: 2px solid #333;">
            <div class="sidebar-header">
                <h3>⚙️ GAME SETTINGS</h3>
                <?php if ($hasRematchSettings): ?>
                    <p style="font-size: 12px; color: #27ae60; margin: 5px 0 0 0;">🔄 Rematch settings loaded!</p>
                <?php endif; ?>
            </div>

            <?php
            $defaultMaxRounds = $rematchSettings['max_rounds'] ?? 15;
            $defaultTradingDuration = $rematchSettings['trading_duration'] ?? 2;
            $defaultDiceDuration = $rematchSettings['dice_duration'] ?? 15;
            $defaultStartingCash = $rematchSettings['starting_cash'] ?? 5000;
            ?>

            <div class="setting-group" style="margin-bottom: 15px;">
                <label>Max Rounds: <span id="val_rounds"><?= $defaultMaxRounds ?></span></label>
                <input type="range" name="max_rounds" form="startGameForm"
                       min="1" max="50" value="<?= $defaultMaxRounds ?>" class="retro-slider"
                       oninput="document.getElementById('val_rounds').innerText = this.value">
            </div>

            <div class="setting-group" style="margin-bottom: 15px;">
                <label>Trading Timer: <span id="val_trading"><?= $defaultTradingDuration ?></span> min</label>
                <input type="range" name="trading_duration" form="startGameForm"
                       min="1" max="10" value="<?= $defaultTradingDuration ?>" class="retro-slider"
                       oninput="document.getElementById('val_trading').innerText = this.value">
            </div>

            <div class="setting-group" style="margin-bottom: 15px;">
                <label>Dice Timer: <span id="val_dice"><?= $defaultDiceDuration ?></span> sec</label>
                <input type="range" name="dice_duration" form="startGameForm"
                       min="0" max="30" value="<?= $defaultDiceDuration ?>" class="retro-slider"
                       oninput="document.getElementById('val_dice').innerText = this.value">
                <br><small>0 = instant auto-roll</small>
            </div>

            <div class="setting-group" style="margin-bottom: 15px;">
                <label>Starting Cash: <span id="val_cash">$<?= number_format($defaultStartingCash) ?></span></label>
                <input type="range" name="starting_cash" form="startGameForm"
                       min="500" max="20000" step="500" value="<?= $defaultStartingCash ?>" class="retro-slider"
                       oninput="document.getElementById('val_cash').innerText = '$' + Number(this.value).toLocaleString()">
            </div>

            <button type="button" class="btn-reset" onclick="resetSettings()" style="width: 100%;">↻ Reset Defaults</button>
        </aside>
    <?php endif; ?>

</div>

<script>
    let autoRefreshEnabled = true;
    let refreshTimeout;

    function toggleAutoRefresh() {
        autoRefreshEnabled = document.getElementById('autoRefresh').checked;
        if (autoRefreshEnabled) {
            startAutoRefresh();
        } else {
            clearTimeout(refreshTimeout);
        }
    }

    function startAutoRefresh() {
        if (autoRefreshEnabled) {
            refreshTimeout = setTimeout(function() {
                location.reload();
            }, 3000);
        }
    }

    function confirmStart() {
        clearTimeout(refreshTimeout);
        return confirm('Start the game now?');
    }

    function copyGameLink() {
        const input = document.getElementById('gameLink');
        input.select();
        document.execCommand('copy');

        const button = document.getElementById('copyButton');
        button.textContent = 'Copied!';
        setTimeout(() => {
            button.textContent = 'Copy';
        }, 2000);
    }

    function resetSettings() {
        const defaults = {
            'max_rounds': 15,
            'trading_duration': 2,
            'dice_duration': 15,
            'starting_cash': 5000
        };

        for (const [name, value] of Object.entries(defaults)) {
            const input = document.querySelector(`input[name="${name}"]`);
            if (input) {
                input.value = value;
                input.dispatchEvent(new Event('input'));
            }
        }
    }

    startAutoRefresh();
</script>
</body>
</html>