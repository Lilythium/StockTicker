/* ===== GAME OVER LOGIC ===== */

document.addEventListener('DOMContentLoaded', function() {
    // Only initialize chart if the data exists on the window object
    if (window.gameOverData && window.gameOverData.history && Object.keys(window.gameOverData.history).length > 0) {
        initializeNetWorthChart(window.gameOverData.players, window.gameOverData.history);
    }
});

function initializeNetWorthChart(players, history) {
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

    // Find the maximum round reached
    let maxRound = 1;
    for (const slot in history) {
        if (history[slot].length > 0) {
            const lastEntry = history[slot][history[slot].length - 1];
            maxRound = Math.max(maxRound, lastEntry[0]);
        }
    }

    // Build the datasets for Chart.js
    const datasets = players.map((player, index) => {
        const slot = player.slot;
        const playerHistory = history[slot] || [];

        // Map rounds to data points
        const data = [];
        for (let round = 1; round <= maxRound; round++) {
            const entry = playerHistory.find(e => e[0] === round);
            if (entry) {
                data.push({ x: round, y: entry[1] });
            }
        }

        return {
            label: player.name,
            data: data,
            borderColor: colors[index % colors.length],
            backgroundColor: colors[index % colors.length] + '20',
            borderWidth: 3,
            tension: 0.1,
            pointRadius: 5,
            pointHoverRadius: 7
        };
    });

    const canvas = document.getElementById('networthChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: { datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'linear',
                    title: { display: true, text: 'Round', font: { size: 14, weight: 'bold' } },
                    ticks: { stepSize: 1 }
                },
                y: {
                    title: { display: true, text: 'Net Worth ($)', font: { size: 14, weight: 'bold' } },
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
                    labels: { padding: 15 }
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
}

/**
 * Handles the rematch logic.
 * Note: The PHP session clearing should happen via an AJAX call
 * or on the landing page, not inside a JS function via PHP tags.
 */
function rematch() {
    if (confirm('Start a new game with the same settings?')) {
        const newGameId = Math.floor(1000 + Math.random() * 9000).toString();
        // Redirect to index with the new game parameter
        // The index.php should be responsible for calling $session->leaveGame()
        window.location.href = 'index.php?game=' + newGameId + '&action=rematch';
    }
}