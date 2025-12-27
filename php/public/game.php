<?php

use includes\GameClient;
use includes\SessionManager;

require_once '../includes/SessionManager.php';
require_once '../includes/GameClient.php';

/* ===== INITIALIZATION & SESSION ===== */
$session = SessionManager::getInstance();
$client = new GameClient();

$gameId = $session->getGameId();
$currentPlayerId = $session->getPlayerId();
$currentPlayerName = $session->getPlayerName();

$response = $client->getGameState($gameId);
$gameState = $response['data'] ?? [];
$gameState['players'] = $gameState['players'] ?? [];
$gameState['stocks']  = $gameState['stocks']  ?? [];
$totalPlayers = $gameState['active_player_count'] ?? 0;

/* ===== REDIRECTS & SAFEGUARDS ===== */
if (!empty($gameState['game_over'])) {
    $session->leaveGame();
    header("Location: game_over.php?game_id=" . urlencode($gameId));
    exit;
}

if (($gameState['status'] ?? '') === 'waiting') {
    header("Location: waiting_room.php");
    exit;
}

/* ===== PLAYER IDENTITY LOGIC ===== */
$currentPlayerSlot = null;
foreach ($gameState['players'] as $slot => $player) {
    if (!empty($player['player_id']) && $player['player_id'] === $currentPlayerId) {
        $currentPlayerSlot = (int)$slot;
        if ($player['name'] !== $currentPlayerName) {
            $_SESSION['player_name'] = $player['name'];
            $currentPlayerName = $player['name'];
        }
        break;
    }
}

if ($currentPlayerSlot === null) {
    foreach ($gameState['players'] as $slot => $player) {
        if (($player['name'] ?? '') === $currentPlayerName) {
            $currentPlayerSlot = (int)$slot;
            break;
        }
    }
}

if ($currentPlayerSlot === null) die("❌ Cannot determine your player slot.");

/* ===== PHASE & UI VARS ===== */
$currentPhase = $gameState['current_phase'] ?? 'trading';
$currentTurn  = $gameState['current_turn'] ?? 0;
$timeRemaining = (int)($gameState['time_remaining'] ?? 0);
$timerDisplay  = sprintf("%02d:%02d", floor($timeRemaining / 60), $timeRemaining % 60);

$isYourTurn    = ($currentTurn == $currentPlayerSlot);
$isDicePhase   = ($currentPhase === 'dice');

$currentPlayerData = $gameState['players'][$currentPlayerSlot] ?? [];
$currentPlayerDoneTrading = $currentPlayerData['done_trading'] ?? false;
$playersDoneTrading = $gameState['done_trading_count'] ?? 0;
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Stock Ticker Game</title>
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/game_style.css">
</head>
<body>

<div class="game-header">
    <div class="header-unified-bar">
        <div class="header-section identity">
            <span class="game-id">ID: <?= htmlspecialchars($gameId) ?></span>
            <span class="player-name-display"><?= htmlspecialchars($currentPlayerName) ?></span>
        </div>

        <div class="header-section phase-logic">
            <?php if ($currentPhase === 'trading'): ?>
                <span class="phase-label trading">🔄 TRADING</span>
                <div class="timer" id="timer" data-remaining="<?= $timeRemaining ?>"><?= $timerDisplay ?></div>
                <div class="players-status"><?= $playersDoneTrading ?>/<?= $totalPlayers ?> Ready</div>
            <?php else: ?>
                <span class="phase-label dice">🎲 DICE</span>
                <div class="timer" id="timer" data-remaining="<?= $timeRemaining ?>"><?= $timerDisplay ?></div>
                <div class="turn-status">
                    <?= $isYourTurn ? '<span class="your-turn-pulse">YOUR TURN</span>' : 'WAITING...' ?>
                </div>
            <?php endif; ?>
        </div>

        <div class="header-section progress-exit">
            <span class="round-display">Round <?= $gameState['current_round'] ?? 1 ?>/<?= $gameState['max_rounds'] ?? 1 ?></span>
            <a href="leave_game.php" class="btn-leave" onclick="return confirm('Leave game?')">LEAVE</a>
        </div>
    </div>
</div>

<div class="action-form <?= ($currentPlayerDoneTrading && $currentPhase === 'trading') ? 'form-disabled' : '' ?>">
    <div class="form-row three-columns">
        <div class="form-column column-roll">
            <button type="button" class="btn-roll-ready" <?= !$isYourTurn || $currentPhase === 'trading' ? 'disabled' : '' ?>>
                <?= $isYourTurn || $currentPhase === 'trading' ? '🎲 ROLL!' : '⏳ Waiting...' ?>
            </button>
        </div>

        <div class="form-column column-trade">
            <form id="tradeForm" class="trade-form">
                <div class="trade-controls">
                    <select name="stock" id="stockSelect" class="stock-select" required <?= ($currentPlayerDoneTrading || $isDicePhase) ? 'disabled' : '' ?>>
                        <?php
                        $stocks = [
                                'Gold' => '#fde68a',
                                'Silver' => '#d8dcdf',
                                'Oil' => '#b3bce5',
                                'Bonds' => '#a8d2f0',
                                'Industrials' => '#dcc2e8',
                                'Grain' => '#f6bfa6'
                        ];
                        foreach($stocks as $name => $color): ?>
                            <option value="<?= $name ?>" style="background-color: <?= $color ?>; ">
                                <?= $name ?>
                            </option>
                        <?php endforeach; ?>
                    </select>

                    <div class="amount-controls">
                        <div class="custom-number-input">
                            <input type="number" name="amount" value="500" class="amount-input" readonly>
                            <div class="spin-buttons">
                                <button type="button" class="spin-btn spin-up" <?= ($currentPlayerDoneTrading || $isDicePhase) ? 'disabled' : '' ?>>▲</button>
                                <button type="button" class="spin-btn spin-down" <?= ($currentPlayerDoneTrading || $isDicePhase) ? 'disabled' : '' ?>>▼</button>
                            </div>
                        </div>
                        <div class="share-quick-buttons">
                            <?php foreach([500 => '500', 1000 => '1K', 2000 => '2K', 5000 => '5K'] as $val => $lbl): ?>
                                <button type="button" class="qty-btn" data-amount="<?= $val ?>" <?= ($currentPlayerDoneTrading || $isDicePhase) ? 'disabled' : '' ?>><?= $lbl ?></button>
                            <?php endforeach; ?>
                        </div>
                    </div>

                    <input type="text" id="costDisplay" class="cost-display" value="COST: $0.00" readonly>

                    <div class="trade-action-buttons">
                        <button type="submit" name="action" value="buy_shares" class="btn-buy" <?= ($currentPlayerDoneTrading || $isDicePhase) ? 'disabled' : '' ?>>Buy</button>
                        <button type="submit" name="action" value="sell_shares" class="btn-sell" <?= ($currentPlayerDoneTrading || $isDicePhase) ? 'disabled' : '' ?>>Sell</button>
                    </div>
                </div>
            </form>
        </div>

        <div class="form-column column-done">
            <div class="done-trading-section">
                <form method="POST" id="doneTradingForm">
                    <input type="hidden" name="done_trading" value="1">
                    <div class="done-trading-control <?= $currentPlayerDoneTrading ? 'checked' : '' ?>">
                        <div class="checkbox-header">
                            <label><?= $currentPlayerDoneTrading ? 'Trading Complete' : 'Done Trading?' ?></label>
                        </div>
                        <div class="checkbox-wrapper">
                            <input type="checkbox"
                                   id="doneTradingCheckbox"
                                   style="display:none;"
                                    <?= $currentPlayerDoneTrading ? 'disabled checked' : '' ?>>
                            <label for="doneTradingCheckbox" class="checkbox-label">
                                <div class="checkbox-box <?= $currentPlayerDoneTrading ? 'checked' : '' ?>">
                                    <span class="checkmark">✓</span>
                                </div>
                            </label>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    </div>
</div>

<div class="stocks_display">
    <table class="stock-price-table">
        <thead>
        <tr>
            <th class="corner-cell"></th>
            <?php for ($p = 0; $p <= 200; $p += 5): ?>
                <th class="<?= in_array($p, [0, 100, 200]) ? 'price-header-special' : 'price-header' ?>"><?= $p ?></th>
            <?php endfor; ?>
        </tr>
        </thead>
        <tbody>
        <?php
        $rows = [
                'Gold' => 'gold', 'Silver' => 'silver', 'Oil' => 'oil',
                'Bonds' => 'bonds', 'Indust.' => 'industrials', 'Grain' => 'grain'
        ];
        foreach ($rows as $name => $class):
            $actualKey = ($name === 'Indust.') ? 'Industrials' : $name;
            $curCents = ($gameState['stocks'][$actualKey] ?? 1.00) * 100;
            ?>
            <tr class="stock-row <?= $class ?>-row">
                <th class="stock-header <?= $class ?>-header"><?= $name ?></th>
                <?php for ($pC = 0; $pC <= 200; $pC += 5):
                    $active = (abs($curCents - $pC) < 2.5);
                    $special = in_array($pC, [0, 100, 200]);
                    $label = ($pC === 0) ? 'Off Market' : (($pC === 100) ? 'Par' : (($pC === 200) ? 'Split' : ''));
                    ?>
                    <td class="price-cell <?= $active ? 'current-price' : '' ?> <?= $special ? 'price-cell-special' : '' ?>"
                        data-stock="<?= $name ?>" data-price="<?= $pC ?>" data-label="<?= $label ?>">
                        <?php if ($active): ?>
                            <div class="price-marker"><?= $pC ?></div>
                        <?php endif; ?>
                    </td>
                <?php endfor; ?>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
</div>

<div class="players">
    <div class="players-container">
        <?php foreach ($gameState['players'] as $slot => $p):
            if (empty($p['player_id'])) continue;
            $isMe = ($currentPlayerName === $p['name']);
            $off = $p['has_left'] ?? false;
            $done = $p['done_trading'] ?? false;
            ?>
            <div class="player-card <?= $isMe ? 'current-player' : '' ?> <?= $off ? 'disconnected' : '' ?>">
                <div class="player-header-row">
                    <div class="player-identity">
                        <span class="player-name"><?= htmlspecialchars($p['name']) ?></span>
                        <?= $isMe ? '<span class="you-badge">YOU</span>' : '' ?>
                        <?= $off ? '<span class="disconnected-badge">OFFLINE</span>' : '' ?>
                        <?= ($done && $currentPhase === 'trading') ? '<span class="done-check">✅</span>' : '' ?>
                    </div>
                    <div class="player-cash">$<?= number_format($p['cash'] ?? 0, 2) ?></div>
                </div>
                <div class="portfolio-section">
                    <table class="portfolio-table">
                        <tbody>
                        <?php foreach (($p['portfolio'] ?? []) as $stk => $shrs): ?>
                            <tr>
                                <td class="stock-name"><?= htmlspecialchars($stk) ?></td>
                                <td class="stock-qty"><?= number_format($shrs) ?> <small>SHRS</small></td>
                                <td class="stock-val">$<?= number_format($shrs * ($gameState['stocks'][$stk] ?? 1.0), 2) ?></td>
                            </tr>
                        <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            </div>
        <?php endforeach; ?>
    </div>
</div>

<div class="history-bar" id="historyBar">
    <div class="history-header" onclick="toggleHistory()">
        <span class="history-title">📜 Game History</span>
        <span class="history-toggle" id="historyToggle">▼</span>
    </div>
    <div class="history-content" id="historyContent">
        <div class="history-empty">No events yet...</div>
    </div>
</div>

<div id="dice-overlay" class="dice-overlay" style="display: none;">
    <div class="dice-tray">
        <div class="die" id="die-stock">?</div>
        <div class="die" id="die-action">?</div>
        <div class="die" id="die-amount">?</div>
    </div>
    <div id="dice-text" class="dice-result-text">Rolling...</div>
</div>

<script>
    window.isDicePhase = <?= $isDicePhase ? 'true' : 'false' ?>;
    window.isYourTurn = <?= $isYourTurn ? 'true' : 'false' ?>;
    window.timeRemaining = <?= $timeRemaining ?>;
    window.currentTurn = <?= $currentTurn ?>;
    window.gameId = <?= json_encode($gameId) ?>;
    window.currentPhase = <?= json_encode($currentPhase) ?>;
    window.currentPlayerSlot = <?= $currentPlayerSlot ?>;
    window.currentPlayerName = <?= json_encode($currentPlayerName) ?>;
    window.initialDiceResults = <?= json_encode($gameState['dice_results'] ?? null) ?>;
    window.playerNames = <?= json_encode(array_column($gameState['players'], 'name')) ?>;
    window.currentPlayerCash = <?= $currentPlayerData['cash'] ?? 0 ?>;
    window.currentPlayerShares = <?= json_encode($currentPlayerData['portfolio'] ?? []) ?>;
    window.initialHistory = <?= json_encode($gameState['history'] ?? []) ?>;
</script>
<script src="js/game.js"></script>
</body>
</html>