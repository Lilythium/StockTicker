<?php

use includes\GameClient;
use includes\SessionManager;

require_once '../includes/SessionManager.php';
require_once '../includes/GameClient.php';

$session = SessionManager::getInstance();

$gameId = $session->getGameId();
if (!$gameId && isset($_GET['game_id'])) {
    $gameId = $_GET['game_id'];
}

$playerId = $session->getPlayerId();

if (!$gameId) {
    header("Location: index.php");
    exit;
}

$client = new GameClient();
$response = $client->getGameState($gameId);
$gameState = $response['data'] ?? [];


if (!isset($gameState['game_over']) || !$gameState['game_over']) {
    if ($session->isInGame()) {
        header("Location: game.php");
        exit;
    }
    header("Location: index.php");
    exit;
}

$rankings = $gameState['final_rankings'] ?? [];

if (empty($rankings)) {
    $rankings = [];
    foreach ($gameState['players'] as $slot => $player) {
        if ($player['is_active']) {
            $rankings[] = [
                    'slot' => $slot,
                    'player_id' => $player['player_id'],
                    'name' => $player['name'],
                    'net_worth' => $player['net_worth'],
                    'cash' => $player['cash'],
                    'portfolio' => $player['portfolio']
            ];
        }
    }
    usort($rankings, function($a, $b) {
        return $b['net_worth'] <=> $a['net_worth'];
    });
}

$winner = $gameState['winner'] ?? null;
$networthHistory = $gameState['networth_history'] ?? [];
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Game Over - Stock Ticker</title>
    <link rel="stylesheet" href="css/game_over_style.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js"></script>
</head>
<body>
<div class="end-container">
    <header class="end-header">
        <h1>🎮 Game Over</h1>
        <p class="game-id-tag">Game ID: <?= htmlspecialchars($gameId) ?></p>
        <?php if ($winner): ?>
            <p class="winner-announcement">
                🏆 <strong><?= htmlspecialchars($winner['name']) ?></strong> wins with
                <strong>$<?= number_format($winner['networth'], 2) ?></strong>!
            </p>
        <?php endif; ?>
    </header>

    <div class="end-layout">
        <section class="standings-column">
            <h2 class="section-title">Final Standings</h2>
            <div class="leaderboard">
                <?php
                $rank = 1;
                foreach ($rankings as $player):
                    $isYou = ($playerId && $player['player_id'] === $playerId);
                    $rankClass = ($rank <= 3) ? "rank-$rank" : "";
                    ?>
                    <div class="player-rank-card <?= $rankClass ?> <?= $isYou ? 'is-you' : '' ?>">
                        <div class="rank-number"><?= $rank ?></div>
                        <div class="player-info">
                            <span class="player-name">
                                <?= htmlspecialchars($player['name']) ?>
                                <?php if ($isYou): ?><span class="you-pill">(you)</span><?php endif; ?>
                            </span>
                            <span class="player-worth">$<?= number_format($player['net_worth'], 2) ?></span>
                        </div>
                        <?php if ($rank === 1): ?><div class="medal">🏆</div><?php endif; ?>
                        <?php if ($rank === 2): ?><div class="medal">🥈</div><?php endif; ?>
                        <?php if ($rank === 3): ?><div class="medal">🥉</div><?php endif; ?>
                    </div>
                    <?php
                    $rank++;
                endforeach;
                ?>
            </div>

            <div class="end-actions">
                <button onclick="rematch()" class="btn-primary" style="margin-bottom: 10px;">🔄 Rematch</button>
                <a href="index.php" class="btn-primary">Return to Lobby</a>
            </div>
        </section>

        <section class="chart-column">
            <h2 class="section-title">Performance History</h2>
            <div class="chart-placeholder">
                <?php if (!empty($networthHistory)): ?>
                    <canvas id="networthChart" width="600" height="400"></canvas>
                <?php else: ?>
                    <div class="placeholder-content">
                        <p>No performance history available</p>
                        <p style="color: #666; font-size: 14px; margin-top: 10px;">
                            (Net worth tracking will be available in future updates)
                        </p>
                    </div>
                <?php endif; ?>
            </div>
        </section>
    </div>

    <section class="game-history-section">
        <h2 class="section-title">📜 Game History</h2>
        <div class="history-display">
            <?php if (!empty($gameState['history'])): ?>
                <?php foreach (array_reverse(array_slice($gameState['history'], -100)) as $entry): ?>
                    <?php
                    $time = (int)$entry['timestamp'];
                    $timestamp = date('H:i:s', $time);
                    $type = $entry['type'] ?? 'system';
                    ?>
                    <div class="history-entry history-<?= $type ?>">
                        <span class="history-time">[<?= $timestamp ?>]</span>
                        <span class="history-message"><?= htmlspecialchars($entry['message']) ?></span>
                    </div>
                <?php endforeach; ?>
            <?php else: ?>
                <p>No game history available</p>
            <?php endif; ?>
        </div>
    </section>
</div>

<script>
    <?php if (!empty($networthHistory)): ?>
    // Prepare data for Chart.js
    const colors = [
        'rgb(241, 196, 15)',  // Gold
        'rgb(189, 195, 199)', // Silver
        'rgb(52, 152, 219)',  // Blue
        'rgb(155, 89, 182)',  // Purple
        'rgb(46, 204, 113)',  // Green
        'rgb(230, 126, 34)',  // Orange
        'rgb(231, 76, 60)',   // Red
        'rgb(149, 165, 166)'  // Gray
    ];

    const players = <?= json_encode($rankings) ?>;
    const history = <?= json_encode($networthHistory) ?>;

    // Get all rounds
    let maxRound = 1;
    for (const slot in history) {
        if (history[slot].length > 0) {
            const lastEntry = history[slot][history[slot].length - 1];
            maxRound = Math.max(maxRound, lastEntry[0]);
        }
    }

    // Build datasets
    const datasets = [];
    players.forEach((player, index) => {
        const slot = player.slot;
        const playerHistory = history[slot] || [];

        // Convert to format: [{x: round, y: networth}, ...]
        const data = [];
        for (let round = 1; round <= maxRound; round++) {
            const entry = playerHistory.find(e => e[0] === round);
            if (entry) {
                data.push({x: round, y: entry[1]});
            }
        }

        datasets.push({
            label: player.name,
            data: data,
            borderColor: colors[index % colors.length],
            backgroundColor: colors[index % colors.length] + '20',
            borderWidth: 3,
            tension: 0.1,
            pointRadius: 5,
            pointHoverRadius: 7
        });
    });

    // Create chart
    const ctx = document.getElementById('networthChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Round',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        stepSize: 1
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Net Worth ($)',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toLocaleString();
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        font: {
                            size: 12,
                            family: "'Arvo', serif"
                        },
                        padding: 15
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': $' + context.parsed.y.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                            });
                        }
                    }
                }
            }
        }
    });
    <?php endif; ?>

    function rematch() {
        if (confirm('Start a new game with the same settings?')) {
            // Generate new game ID
            const newGameId = Math.floor(1000 + Math.random() * 9000).toString();

            <?php $session->leaveGame(); ?>

            window.location.href = 'index.php?game=' + newGameId;
        }
    }
</script>
</body>
</html>