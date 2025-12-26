/**
 * Waiting Room JavaScript
 * Handles auto-refresh and copy functionality
 */

let autoRefreshEnabled = true;
let refreshTimeout;
let lastPlayerCount = 0;
let lastGameStatus = 'waiting';

document.addEventListener('DOMContentLoaded', function() {
    initializeWaitingRoom();
});

function initializeWaitingRoom() {
    // Get initial state from page
    const playerItems = document.querySelectorAll('.player-item');
    lastPlayerCount = playerItems.length;

    // Start polling
    startAutoRefresh();
}

function toggleAutoRefresh() {
    autoRefreshEnabled = document.getElementById('autoRefresh').checked;
    if (autoRefreshEnabled) {
        startAutoRefresh();
    } else {
        clearTimeout(refreshTimeout);
    }
}

async function checkForUpdates() {
    try {
        const gameId = getGameIdFromPage();
        if (!gameId) return;

        const response = await fetch(`get_game_state.php?game_id=${encodeURIComponent(gameId)}&_=${Date.now()}`);
        const data = await response.json();

        if (!data.success || !data.data) return;

        const gameState = data.data;

        // Check if game started
        if (gameState.status === 'active') {
            window.location.href = 'game.php';
            return;
        }

        // Check if game is over
        if (gameState.game_over) {
            window.location.href = `game_over.php?game_id=${encodeURIComponent(gameId)}`;
            return;
        }

        // Count active players
        let currentPlayerCount = 0;
        if (gameState.players) {
            for (const slot in gameState.players) {
                if (gameState.players[slot].player_id) {
                    currentPlayerCount++;
                }
            }
        }

        // Reload if player count changed
        if (currentPlayerCount !== lastPlayerCount) {
            location.reload();
            return;
        }

    } catch (error) {
        console.error('Error checking for updates:', error);
    }

    // Schedule next check
    if (autoRefreshEnabled) {
        refreshTimeout = setTimeout(checkForUpdates, 3000);
    }
}

function startAutoRefresh() {
    if (autoRefreshEnabled) {
        clearTimeout(refreshTimeout);
        refreshTimeout = setTimeout(checkForUpdates, 3000);
    }
}

function getGameIdFromPage() {
    // Try to get from game ID display
    const gameIdEl = document.querySelector('.game-id-value');
    if (gameIdEl) {
        return gameIdEl.textContent.trim();
    }

    // Try to get from URL
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('game_id');
}

function confirmStart() {
    clearTimeout(refreshTimeout);
    return confirm('Start the game now?');
}

function copyGameLink() {
    const input = document.getElementById('gameLink');
    const button = document.getElementById('copyButton');

    if (!input || !button) return;

    const textToCopy = input.value;

    // Modern clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textToCopy).then(() => {
            button.textContent = 'Copied!';
            button.style.background = '#27ae60';
            setTimeout(() => {
                button.textContent = 'Copy';
                button.style.background = '';
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy:', err);
            fallbackCopy(input, button);
        });
    } else {
        // Fallback for older browsers
        fallbackCopy(input, button);
    }
}

function fallbackCopy(input, button) {
    try {
        input.select();
        input.setSelectionRange(0, 99999); // For mobile devices

        const successful = document.execCommand('copy');
        if (successful) {
            button.textContent = 'Copied!';
            button.style.background = '#27ae60';
            setTimeout(() => {
                button.textContent = 'Copy';
                button.style.background = '';
            }, 2000);
        }

        // Remove selection
        window.getSelection().removeAllRanges();
    } catch (err) {
        console.error('Fallback copy failed:', err);
        alert('Copy failed. Please copy manually: ' + input.value);
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
        const input = document.querySelector(`input[name="${name}"]`);
        if (input) {
            input.value = value;
            // Trigger input event to update display
            const event = new Event('input', { bubbles: true });
            input.dispatchEvent(event);
        }
    }
}

// Make functions available globally
window.toggleAutoRefresh = toggleAutoRefresh;
window.confirmStart = confirmStart;
window.copyGameLink = copyGameLink;
window.resetSettings = resetSettings;