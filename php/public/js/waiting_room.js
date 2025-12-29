/**
 * Waiting Room JavaScript (Socket.IO Only Version)
 * All game logic handled via Socket.IO - no PHP backend calls
 */

let lastPlayerCount = 0;
let currentGameState = null;
let isHost = false;
let isJoining = false;
let isRedirecting = false;

/* ===== AUDIO HELPERS ===== */
const AUDIO_PATHS = {
    ui: {
        click: '../../audio/button-click.ogg'
    }
};

let lastClickTime = 0;

function playClick(isSlider = false) {
    const now = Date.now();
    // If it's a slider, only play if 80ms has passed since the last click
    // If it's a regular button, play immediately
    if (isSlider && now - lastClickTime < 80) {
        return;
    }

    lastClickTime = now;
    const audio = new Audio(AUDIO_PATHS.ui.click);
    audio.play().catch(e => console.log("Audio blocked"));
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('🎮 Initializing Waiting Room...');

    // Initialize Socket.IO client
    if (!window.gameSocket) {
        window.gameSocket = new GameSocketClient(window.SOCKETIO_SERVER || 'http://127.0.0.1:9999');
    }

    // Connect to server
    gameSocket.connect();

    // Set up event handlers
    setupSocketHandlers();

    // Join the game via Socket.IO
    setTimeout(() => {
        joinGameViaSocket();
    }, 500);

    // Load saved settings
    loadSavedSettings();

    // Setup UI listeners
    const settingInputs = document.querySelectorAll('.retro-slider');
    settingInputs.forEach(input => {
        // 'input' fires while dragging, 'change' fires when they let go
        // We use 'input' but you might want to throttle it if it's too noisy
        input.addEventListener('input', () => {
            // Optional: only play if value is a multiple of something to reduce noise
            playClick(true);
            saveCurrentSettings();
        });
    });
    const startBtn = document.getElementById('startGameBtn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            if (!startBtn.disabled) playClick();
        });
    }
    const leaveBtn = document.querySelector('.btn-leave');
    if (leaveBtn) {
        leaveBtn.addEventListener('click', playClick);
    }
    const resetBtn = document.querySelector('.btn-reset');
    if (resetBtn) {
        resetBtn.addEventListener('click', playClick);
    }
    const copyBtn = document.getElementById('copyButton');
    if (copyBtn) {
        copyBtn.addEventListener('click', playClick);
    }

    console.log('✅ Waiting Room Initialized');
});

function setupSocketHandlers() {
    // Handle connection status
    gameSocket.onConnectionChange = (connected) => {
        console.log(connected ? '✅ Connected to server' : '❌ Disconnected from server');

        if (connected && window.gameId && window.playerId) {
            // Rejoin if we reconnect, but only if we aren't already joining
            if (!isJoining) {
                console.log('🔄 Re-establishing session...');
                joinGameViaSocket();
            }
        }
    };

    // Handle join result
    gameSocket.socket.on('join_result', (data) => {
        console.log('Join result:', data);
        isJoining = false; // Release the guard

        if (data.success) {
            const state = data.game_state;
            handleGameStateUpdate(state);
        } else {
            console.error('Failed to join game:', data.error);
            // Only redirect to index if it's a critical error (like game doesn't exist)
            if (data.error && data.error.includes("not found")) {
                window.location.href = 'index.php';
            }
        }
    });

    // Handle state updates
    gameSocket.onStateUpdate = (state) => {
        console.log('📊 State update received');
        handleGameStateUpdate(state);
    };

    // Handle game started
    gameSocket.socket.on('game_started', () => {
        if (isRedirecting) return;
        isRedirecting = true;

        console.log('🎮 Game starting!');
        showStartingMessage();

        setTimeout(() => {
            window.location.href = 'game.php';
        }, 1500);
    });

    // Handle errors
    gameSocket.onError = (message) => {
        console.error('Socket error:', message);
        // Alerting here can sometimes cause loops if it triggers on every retry
        // Consider a UI toast instead of a blocking alert
    };
}

function joinGameViaSocket() {
    if (isJoining || isRedirecting) return;

    if (!window.gameId || !window.playerId || !window.playerName) {
        console.error('Missing game credentials');
        return;
    }

    isJoining = true;

    console.log('Joining game via Socket.IO:', {
        gameId: window.gameId,
        playerId: window.playerId,
        playerName: window.playerName
    });

    gameSocket.joinGame(
        window.gameId,
        window.playerId,
        window.playerName,
        window.maxPlayers || 4
    );
}

function handleGameStateUpdate(state) {
    if (!state || isRedirecting) return;

    currentGameState = state;

    console.log('📊 State update:', {
        status: state.status,
        round: state.current_round,
        phase: state.current_phase,
        game_over: state.game_over
    });

    // Check if game started - BOTH conditions must be true
    if (state.status === 'active' && state.current_round >= 1) {
        if (!isRedirecting) {
            isRedirecting = true;
            console.log('🎮 Game is active (round ' + state.current_round + '), redirecting to game...');

            // Play sound
            playGameStartSound();

            // Show starting message
            showStartingMessage();

            // Redirect after animation
            setTimeout(() => {
                window.location.href = 'game.php';
            }, 1500);
        }
        return;
    }

    // Check if game is over
    if (state.game_over) {
        if (!isRedirecting) {
            isRedirecting = true;
            console.log('🏁 Game is over, redirecting...');
            setTimeout(() => {
                window.location.href = `game_over.php?game_id=${window.gameId}`;
            }, 500);
        }
        return;
    }

    // Determine if we're the host
    isHost = (state.host_player_id === window.playerId);

    // Update UI components
    updatePlayerList(state);
    updateHostControls(isHost, state);
}

// Also add a safety check at the top of the file
let lastStateUpdate = 0;
const STATE_UPDATE_THROTTLE = 100; // ms

// Wrap the Socket.IO state handler with throttling
gameSocket.onStateUpdate = (state) => {
    const now = Date.now();
    if (now - lastStateUpdate < STATE_UPDATE_THROTTLE) {
        console.log('⏸️ Throttling state update');
        return;
    }
    lastStateUpdate = now;
    handleGameStateUpdate(state);
};

function updatePlayerList(state) {
    const playerList = document.getElementById('playerList');
    const playerCountEl = document.getElementById('playerCount');

    if (!playerList) return;

    const players = state.players || {};
    const maxPlayers = state.player_count || window.maxPlayers || 4;

    let activePlayers = 0;
    let html = '';

    // Convert slots to array and sort to maintain order
    const slots = Object.keys(players).sort();

    slots.forEach(slot => {
        const player = players[slot];
        if (!player.player_id) return;

        activePlayers++;

        const isYou = (player.player_id === window.playerId);
        const isHostPlayer = (player.player_id === state.host_player_id);
        const isDisconnected = player.has_left || false;

        const itemClass = 'player-item' +
            (isYou ? ' you' : '') +
            (isHostPlayer ? ' host' : '') +
            (isDisconnected ? ' disconnected' : '');

        html += `
            <div class="${itemClass}">
                <div class="player-name">
                    ${escapeHtml(player.name)}
                    ${isYou ? '<span class="player-badge you">You</span>' : ''}
                    ${isHostPlayer ? '<span class="player-badge host">Host</span>' : ''}
                    ${isDisconnected ? '<span class="player-badge disconnected">OFFLINE</span>' : ''}
                </div>
                <div class="player-status">${isDisconnected ? '⌛ Wait' : 'Ready ✅'}</div>
            </div>
        `;
    });

    // Add empty slots
    for (let i = activePlayers; i < maxPlayers; i++) {
        html += '<div class="empty-slot">Waiting for player...</div>';
    }

    playerList.innerHTML = html;

    if (playerCountEl) {
        playerCountEl.textContent = activePlayers;
    }

    lastPlayerCount = activePlayers;
}

function updateHostControls(isHostPlayer, state) {
    const hostControls = document.getElementById('hostControls');
    const hostSidebar = document.getElementById('hostSidebar');
    const waitingMessage = document.getElementById('waitingMessage');
    const startBtn = document.getElementById('startGameBtn');

    const activePlayers = state.active_player_count || 0;
    const canStart = (activePlayers >= 2);

    if (isHostPlayer) {
        // Show host controls
        if (hostControls) hostControls.style.display = 'block';
        if (hostSidebar) hostSidebar.style.display = 'block';
        if (waitingMessage) waitingMessage.style.display = 'none';

        // Update start button
        if (startBtn) {
            startBtn.disabled = !canStart;
            startBtn.textContent = canStart ? 'Start Game' : '⛔ Need 2+ Players';
        }
    } else {
        // Show waiting message for non-hosts
        if (hostControls) hostControls.style.display = 'none';
        if (hostSidebar) hostSidebar.style.display = 'none';
        if (waitingMessage) waitingMessage.style.display = 'block';
    }
}

function startGame() {
    if (!isHost) {
        alert('Only the host can start the game');
        return;
    }

    playClick();

    if (!confirm('Start the game now?')) {
        return;
    }

    // Gather settings
    const settings = {
        max_rounds: parseInt(document.getElementById('hidden_max_rounds')?.value || 15),
        trading_duration: parseInt(document.getElementById('hidden_trading_duration')?.value || 2),
        dice_duration: parseInt(document.getElementById('hidden_dice_duration')?.value || 15),
        starting_cash: parseInt(document.getElementById('hidden_starting_cash')?.value || 5000)
    };

    console.log('Starting game with settings:', settings);

    // Start via Socket.IO
    gameSocket.startGame(settings);

    // Disable button
    const startBtn = document.getElementById('startGameBtn');
    if (startBtn) {
        startBtn.disabled = true;
        startBtn.textContent = '🎮 Starting...';
    }
}

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

function playGameStartSound() {
    try {
        const audio = new Audio('/stock_ticker/audio/game-start.mp3');
        audio.play().catch(e => console.log('Audio playback blocked:', e));
    } catch (e) {
        console.log('Could not play game start sound:', e);
    }
}

// Settings management
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

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make functions available globally
window.startGame = startGame;
window.copyGameLink = copyGameLink;
window.resetSettings = resetSettings;
window.updateSetting = updateSetting;