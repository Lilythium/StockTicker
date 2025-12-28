<?php

use includes\SessionManager;

require_once '../includes/SessionManager.php';
require_once '../includes/env_loader.php';  // ← ADD THIS LINE

/* ===== SESSION CHECK ===== */
$session = SessionManager::getInstance();

if (!$session->isInGame()) {
    header("Location: index.php");
    exit;
}

$gameId = $session->getGameId();
$currentPlayerId = $session->getPlayerId();
$currentPlayerName = $session->getPlayerName();

// Get Socket.IO server URL from environment
$socketioServer = getenv('SOCKETIO_SERVER') ?: 'http://127.0.0.1:9999';

// All game state will be fetched via Socket.IO
// No need to query the backend here
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

<!-- Header will be populated by JavaScript -->
<div class="game-header">
    <div class="header-unified-bar">
        <div class="header-section identity">
            <span class="game-id">ID: <?= htmlspecialchars($gameId) ?></span>
            <span class="player-name-display"><?= htmlspecialchars($currentPlayerName) ?></span>
        </div>

        <div class="header-section phase-logic">
            <span class="phase-label trading">🔄 LOADING...</span>
            <div class="timer" id="timer">--:--</div>
            <div class="players-status">0/0</div>
        </div>

        <div class="header-section progress-exit">
            <span class="round-display">Round 1/1</span>
            <a href="leave_game.php" class="btn-leave" onclick="return confirm('Leave game?')">LEAVE</a>
        </div>
    </div>
</div>

<!-- Action Form -->
<div class="action-form">
    <div class="form-row three-columns">
        <!-- Roll Column -->
        <div class="form-column column-roll">
            <button type="button" id="btnRollDice" class="btn-roll-ready" disabled>⏳ Loading...</button>
        </div>

        <!-- Trade Column -->
        <div class="form-column column-trade">
            <form id="tradeForm" class="trade-form">
                <div class="trade-controls">
                    <select name="stock" id="stockSelect" class="stock-select" required disabled>
                        <option value="Gold" style="background-color: #fde68a;">Gold</option>
                        <option value="Silver" style="background-color: #d8dcdf;">Silver</option>
                        <option value="Oil" style="background-color: #b3bce5;">Oil</option>
                        <option value="Bonds" style="background-color: #a8d2f0;">Bonds</option>
                        <option value="Industrials" style="background-color: #dcc2e8;">Industrials</option>
                        <option value="Grain" style="background-color: #f6bfa6;">Grain</option>
                    </select>

                    <div class="amount-controls">
                        <div class="custom-number-input">
                            <input type="number" name="amount" value="500" class="amount-input" readonly>
                            <div class="spin-buttons">
                                <button type="button" class="spin-btn spin-up" disabled>▲</button>
                                <button type="button" class="spin-btn spin-down" disabled>▼</button>
                            </div>
                        </div>
                        <div class="share-quick-buttons">
                            <button type="button" class="qty-btn" data-amount="500" disabled>500</button>
                            <button type="button" class="qty-btn" data-amount="1000" disabled>1K</button>
                            <button type="button" class="qty-btn" data-amount="2000" disabled>2K</button>
                            <button type="button" class="qty-btn" data-amount="5000" disabled>5K</button>
                        </div>
                    </div>

                    <input type="text" id="costDisplay" class="cost-display" value="COST: $0.00" readonly>

                    <div class="trade-action-buttons">
                        <button type="button" id="btnBuy" class="btn-buy" disabled>Buy</button>
                        <button type="button" id="btnSell" class="btn-sell" disabled>Sell</button>
                    </div>
                </div>
            </form>
        </div>

        <!-- Done Column -->
        <div class="form-column column-done">
            <div class="done-trading-section">
                <form id="doneTradingForm">
                    <input type="hidden" name="done_trading" value="1">
                    <div class="done-trading-control">
                        <div class="checkbox-header">
                            <label>Done Trading?</label>
                        </div>
                        <div class="checkbox-wrapper">
                            <input type="checkbox" id="doneTradingCheckbox" style="display:none;" disabled>
                            <label for="doneTradingCheckbox" class="checkbox-label">
                                <div class="checkbox-box">
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

<!-- Stock Price Board -->
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
            ?>
            <tr class="stock-row <?= $class ?>-row">
                <th class="stock-header <?= $class ?>-header"><?= $name ?></th>
                <?php for ($pC = 0; $pC <= 200; $pC += 5):
                    $special = in_array($pC, [0, 100, 200]);
                    $label = ($pC === 0) ? 'Off Market' : (($pC === 100) ? 'Par' : (($pC === 200) ? 'Split' : ''));
                    ?>
                    <td class="price-cell <?= $special ? 'price-cell-special' : '' ?>"
                        data-stock="<?= $name ?>" data-price="<?= $pC ?>" data-label="<?= $label ?>">
                    </td>
                <?php endfor; ?>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
</div>

<!-- Player Cards -->
<div class="players">
    <div class="players-container" id="playersContainer">
        <!-- Will be populated by JavaScript -->
        <div style="text-align: center; padding: 40px; color: #666;">
            Loading players...
        </div>
    </div>
</div>

<!-- History Bar -->
<div class="history-bar" id="historyBar">
    <div class="history-header" onclick="toggleHistory()">
        <span class="history-title">📜 Game History</span>
        <span class="history-toggle" id="historyToggle">▼</span>
    </div>
    <div class="history-content" id="historyContent">
        <div class="history-empty">Connecting...</div>
    </div>
</div>

<!-- Dice Overlay -->
<div id="dice-overlay" class="dice-overlay" style="display: none;">
    <div class="dice-tray">
        <div class="die" id="die-stock">?</div>
        <div class="die" id="die-action">?</div>
        <div class="die" id="die-amount">?</div>
    </div>
    <div id="dice-text" class="dice-result-text">Rolling...</div>
</div>

<!-- Scripts -->
<script>
    // Pass PHP data to JavaScript
    window.gameId = <?= json_encode($gameId) ?>;
    window.currentPlayerId = <?= json_encode($currentPlayerId) ?>;
    window.currentPlayerName = <?= json_encode($currentPlayerName) ?>;
    window.SOCKETIO_SERVER = <?= json_encode($socketioServer) ?>;

    // These will be set by Socket.IO
    window.currentPlayerSlot = null;
    window.isDicePhase = false;
    window.isYourTurn = false;
    window.currentPhase = null;
    window.currentTurn = null;
    window.timeRemaining = 0;
</script>

<script src="https://cdn.socket.io/4.6.0/socket.io.min.js"></script>
<script src="js/game_socketio.js"></script>
<script src="js/game.js"></script>
</body>
</html>