/**
 * Waiting Room JavaScript (Socket.IO Version)
 * Real-time player updates and game start handling
 */

let lastPlayerCount = 0;

document.addEventListener('DOMContentLoaded', function() {
    initializeWaitingRoom();
    loadSavedSettings();
});

function initializeWaitingRoom() {
    // Get initial player count
    const playerItems = document.querySelectorAll('.player-item');
    lastPlayerCount = playerItems.length;

    // Setup game socket event handlers for waiting room
    if (gameSocket) {
        // Handle state updates
        gameSocket.onStateUpdate = handleWaitingRoomUpdate;

        // Handle game started event
        gameSocket.socket.on('game_started', () => {
            console.log('🎮 Game starting!');
            playSound('/stock_ticker/audio/game-start.mp3');

            // Show starting message
            showStartingMessage();

            // Redirect after brief delay
            setTimeout(() => {
                window.location.href = 'game.php';
            }, 1500);
        });

        // Join the game room if we have credentials
        if (window.gameId && window.playerId) {
            const playerName = document.querySelector('.player-name')?.textContent.trim() || 'Player';

            console.log('Joining waiting room:', {
                gameId: window.gameId,
                playerId: window.playerId,
                playerName: playerName
            });

            gameSocket.joinGame(
                window.gameId,
                window.playerId,
                playerName
            );
        }
    }

    // Add event listeners to save settings when changed
    const settingInputs = document.querySelectorAll(
        'input[name="max_rounds"], input[name="trading_duration"], input[name="dice_duration"], input[name="starting_cash"]'
    );
    settingInputs.forEach(input => {
        input.addEventListener('input', saveCurrentSettings);
    });
}

/**
 * Handle game state updates in waiting room
 */
function handleWaitingRoomUpdate(state) {
    console.log('Waiting room state update:', state);

    // Check if game has started
    if (state.status === 'active') {
        console.log('Game is active, redirecting...');
        window.location.href = 'game.php';
        return;
    }

    // Check if game is over
    if (state.game_over) {
        console.log('Game is over, redirecting...');
        window.location.href = `game_over.php?game_id=${window.gameId}`;
        return;
    }

    // Count active players
    let currentPlayerCount = 0;
    const playerSlots = state.players || {};

    for (const slot in playerSlots) {
        const player = playerSlots[slot];
        if (player.player_id && player.is_active) {
            currentPlayerCount++;
        }
    }

    console.log(`Player count: ${currentPlayerCount} (was ${lastPlayerCount})`);

    // Reload page if player count changed
    if (currentPlayerCount !== lastPlayerCount) {
        console.log('Player count changed, reloading...');
        location.reload();
    }

    // Update player list dynamically (optional - more advanced)
    updatePlayerList(playerSlots);
}

/**
 * Update player list without full page reload
 */
function updatePlayerList(players) {
    const playerListContainer = document.querySelector('.player-list');
    if (!playerListContainer) return;

    // Clear current list
    playerListContainer.innerHTML = '';

    let activePlayers = 0;
    const maxPlayers = window.maxPlayers || 4;

    // Add active players
    for (const slot in players) {
        const player = players[slot];
        if (!player.player_id || !player.is_active) continue;

        activePlayers++;

        const isYou = player.player_id === window.playerId;
        const isHost = player.player_id === window.hostPlayerId;
        const isDisconnected = player.has_left || false;

        const itemClass = 'player-item' +
            (isYou ? ' you' : '') +
            (isHost ? ' host' : '');

        const playerDiv = document.createElement('div');
        playerDiv.className = itemClass;
        playerDiv.innerHTML = `
            <div class="player-name">
                ${escapeHtml(player.name)}
                ${isYou ? '<span class="player-badge you">You</span>' : ''}
                ${isHost ? '<span class="player-badge host">Host</span>' : ''}
                ${isDisconnected ? '<span class="player-badge disconnected">Disconnected</span>' : ''}
            </div>
            <div style="font-weight: bold;">Ready ✅</div>
        `;

        playerListContainer.appendChild(playerDiv);
    }

    // Add empty slots
    for (let i = activePlayers; i < maxPlayers; i++) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'empty-slot';
        emptyDiv.textContent = 'Waiting for player...';
        playerListContainer.appendChild(emptyDiv);
    }

    // Update player count display
    const playerCountEl = document.getElementById('playerCount');
    if (playerCountEl) {
        playerCountEl.textContent = activePlayers;
    }

    // Update start button state
    const startButton = document.querySelector('.start-button');
    if (startButton && window.isFirstPlayer) {
        const canStart = activePlayers >= 2;
        startButton.disabled = !canStart;
        startButton.textContent = canStart ? 'Start Game' : '⛔ Need 2+ Players';
    }

    lastPlayerCount = activePlayers;
}

/**
 * Show game starting animation/message
 */
function showStartingMessage() {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: radial-gradient(circle, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.95) 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        animation: fadeIn 0.3s;
    `;

    const message = document.createElement('div');
    message.style.cssText = `
        font-family: 'Arvo', serif;
        font-size: 3rem;
        font-weight: bold;
        color: white;
        text-transform: uppercase;
        text-shadow: 3px 3px 0 #000;
        animation: pulse 1s infinite;
    `;
    message.textContent = '🎮 Game Starting...';

    overlay.appendChild(message);
    document.body.appendChild(overlay);
}

/**
 * Handle start game button click
 */
function confirmStart() {
    if (!confirm('Start the game now?')) {
        return false;
    }

    // Gather settings from form
    const settings = {
        max_rounds: parseInt(document.getElementById('hidden_max_rounds')?.value || 15),
        trading_duration: parseInt(document.getElementById('hidden_trading_duration')?.value || 2),
        dice_duration: parseInt(document.getElementById('hidden_dice_duration')?.value || 15),
        starting_cash: parseInt(document.getElementById('hidden_starting_cash')?.value || 5000)
    };

    console.log('Starting game with settings:', settings);

    // Start game via Socket.IO
    if (gameSocket && gameSocket.isConnected()) {
        gameSocket.startGame(settings);
    } else {
        console.error('Socket not connected, falling back to form submission');
        return true; // Allow form submission as fallback
    }

    // Disable button
    const startButton = document.querySelector('.start-button');
    if (startButton) {
        startButton.disabled = true;
        startButton.textContent = '🎮 Starting...';
    }

    return false; // Prevent form submission since we're using Socket.IO
}

/**
 * Settings persistence
 */
function saveCurrentSettings() {
    const settings = {
        max_rounds: document.querySelector('input[name="max_rounds"]')?.value || 15,
        trading_duration: document.querySelector('input[name="trading_duration"]')?.value || 2,
        dice_duration: document.querySelector('input[name="dice_duration"]')?.value || 15,
        starting_cash: document.querySelector('input[name="starting_cash"]')?.value || 5000
    };

    localStorage.setItem('hostSettings', JSON.stringify(settings));
}

function loadSavedSettings() {
    const saved = localStorage.getItem('hostSettings');
    if (!saved) return;

    try {
        const settings = JSON.parse(saved);

        for (const [name, value] of Object.entries(settings)) {
            const rangeInput = document.getElementById('range_' + name);
            const hiddenInput = document.getElementById('hidden_' + name);

            if (rangeInput) {
                rangeInput.value = value;
                updateSetting(name, value);
            }

            if (hiddenInput) {
                hiddenInput.value = value;
            }
        }
    } catch (e) {
        console.error('Error loading saved settings:', e);
    }
}

function updateSetting(name, value) {
    const hiddenInput = document.getElementById('hidden_' + name);
    if (hiddenInput) {
        hiddenInput.value = value;
    }

    if (name === 'max_rounds') {
        const display = document.getElementById('val_rounds');
        if (display) display.innerText = value;
    } else if (name === 'trading_duration') {
        const display = document.getElementById('val_trading');
        if (display) display.innerText = value;
    } else if (name === 'dice_duration') {
        const display = document.getElementById('val_dice');
        if (display) display.innerText = value;
    } else if (name === 'starting_cash') {
        const display = document.getElementById('val_cash');
        if (display) display.innerText = '$' + Number(value).toLocaleString();
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
        const hiddenInput = document.getElementById('hidden_' + name);

        if (rangeInput) {
            rangeInput.value = value;
            const event = new Event('input', { bubbles: true });
            rangeInput.dispatchEvent(event);
        }

        if (hiddenInput) {
            hiddenInput.value = value;
        }
    }

    localStorage.removeItem('hostSettings');
}

/**
 * Copy game link to clipboard
 */
function copyGameLink() {
    const input = document.getElementById('gameLink');
    const button = document.getElementById('copyButton');

    if (!input || !button) return;

    const textToCopy = input.value;

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
        fallbackCopy(input, button);
    }
}

function fallbackCopy(input, button) {
    try {
        input.select();
        input.setSelectionRange(0, 99999);

        const successful = document.execCommand('copy');
        if (successful) {
            button.textContent = 'Copied!';
            button.style.background = '#27ae60';
            setTimeout(() => {
                button.textContent = 'Copy';
                button.style.background = '';
            }, 2000);
        }

        window.getSelection().removeAllRanges();
    } catch (err) {
        console.error('Fallback copy failed:', err);
        alert('Copy failed. Please copy manually: ' + input.value);
    }
}

/**
 * Utility function to escape HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Play sound effect
 */
function playSound(src) {
    const audio = new Audio(src);
    audio.play().catch(e => console.log('Audio blocked:', src));
}

// Make functions available globally
window.confirmStart = confirmStart;
window.copyGameLink = copyGameLink;
window.resetSettings = resetSettings;
window.updateSetting = updateSetting;