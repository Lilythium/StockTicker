/* ===== js/game.js ===== */

// Create global instance
if (!window.gameSocket) {
    window.gameSocket = new GameSocketClient();

    if (window.gameId) gameSocket.gameId = window.gameId;
    if (window.currentPlayerId) gameSocket.playerId = window.currentPlayerId;
    if (window.currentPlayerSlot !== undefined) gameSocket.playerSlot = parseInt(window.currentPlayerSlot);
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('🎮 Initializing UI Logic...');

    // 1. Establish the connection first
    gameSocket.connect();

    // 2. Set up the data and Join (Only do this ONCE)
    if (window.gameId && window.currentPlayerId) {
        gameSocket.gameId = window.gameId;
        gameSocket.playerId = window.currentPlayerId;

        if (window.currentPlayerSlot !== undefined && window.currentPlayerSlot !== null) {
            gameSocket.playerSlot = parseInt(window.currentPlayerSlot);
        }

        console.log("Setting up game:", gameSocket.gameId, "Slot:", gameSocket.playerSlot);

        // Tell the server we are here
        gameSocket.joinGame(window.gameId, window.currentPlayerId, window.currentPlayerName || 'Player');
    }

    // 3. Define the event hooks
    gameSocket.onConnectionChange = (connected) => {
        const indicator = document.getElementById('connectionStatus');
        if (indicator) {
            indicator.style.color = connected ? '#4ade80' : '#f87171';
            indicator.textContent = connected ? '● Online' : '● Offline/Reconnecting...';
        }
    };
    function updatePlayerCardsUI(players, stocks) {
        const container = document.querySelector('.players-container');
        if (!container) return;

        let html = '';

        // Convert object to array if necessary and loop
        Object.keys(players).forEach(slot => {
            const p = players[slot];
            if (!p.player_id) return;

            const isMe = (window.currentPlayerName === p.name);
            const isOff = p.has_left || false;
            const isDone = p.done_trading || false;

            // CSS Classes
            const cardClass = `player-card ${isMe ? 'current-player' : ''} ${isOff ? 'disconnected' : ''}`;

            // Portfolio Calculation
            let totalShrs = 0;
            let totalVal = 0;
            let portfolioRows = '';

            if (p.portfolio) {
                Object.keys(p.portfolio).forEach(stk => {
                    const shrs = p.portfolio[stk];
                    const price = stocks[stk] || 1.0;
                    const value = shrs * price;

                    totalShrs += shrs;
                    totalVal += value;

                    portfolioRows += `
                    <tr>
                        <td class="stock-name">${stk}</td>
                        <td class="stock-qty">${shrs.toLocaleString()} <small>SHRS</small></td>
                        <td class="stock-val">$${value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    </tr>`;
                });
            }

            // Build the Card HTML
            html += `
            <div class="${cardClass}">
                <div class="player-header-row">
                    <div class="player-identity">
                        <span class="player-name">${p.name}</span>
                        ${isMe ? '<span class="you-badge">YOU</span>' : ''}
                        ${isOff ? '<span class="disconnected-badge">OFFLINE</span>' : ''}
                        ${(isDone && window.currentPhase === 'trading') ? '<span class="done-check">✅</span>' : ''}
                    </div>
                    <div class="player-cash">$${(p.cash || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                </div>
                <div class="portfolio-section">
                    <table class="portfolio-table">
                        <tbody>
                            ${portfolioRows}
                            <tr class="portfolio-totals">
                                <td class="stock-name"><strong>Totals</strong></td>
                                <td class="stock-qty">${totalShrs.toLocaleString()}<small> SHRS</small></td>
                                <td class="stock-val">$${totalVal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>`;
        });

        container.innerHTML = html;
    }
    function handleGameStateUpdate(state) {
        console.log("📥 Received new game state:", state);

        window.currentPhase = state.current_phase;
        window.currentTurn = state.current_turn;

        // 1. Update Cash & Portfolio on Player Cards
        if (state.players) {
            updatePlayerCardsUI(state.players, state.stocks);
        }

        // 2. Update Game History
        if (state.history) {
            const historyContent = document.getElementById('historyContent');
            if (historyContent) {
                if (state.history.length === 0) {
                    historyContent.innerHTML = '<div class="history-empty">No events yet...</div>';
                } else {
                    historyContent.innerHTML = state.history.map(event =>
                        `<div class="history-item">${event}</div>`
                    ).reverse().join(''); // Show newest first
                }
            }
        }

        const btnRoll = document.getElementById('btnRollDice');
        const isMyTurn = (window.currentTurn == window.currentPlayerSlot);
        const isDicePhase = (state.current_phase === 'dice');

        if (btnRoll) {
            btnRoll.disabled = !(isMyTurn && isDicePhase);
            btnRoll.textContent = (isMyTurn && isDicePhase) ? '🎲 ROLL!' : '⏳ Waiting...';
        }

        const phaseLabel = document.querySelector('.phase-label');
        if (phaseLabel) {
            phaseLabel.className = `phase-label ${state.current_phase}`;
            phaseLabel.textContent = state.current_phase === 'trading' ? '🔄 TRADING' : '🎲 DICE';
        }

        const timerDisplay = document.getElementById('timer');
        if (timerDisplay && state.time_remaining !== undefined) {
            // Force the value to a whole number
            const totalSeconds = Math.floor(state.time_remaining);

            // Stop local timer if it exists to prevent double-ticking
            if (window.gameTimerInterval) clearInterval(window.gameTimerInterval);

            // Initial draw
            updateTimerText(totalSeconds);

            // Start local "smooth" countdown so it moves every second
            let localSeconds = totalSeconds;
            window.gameTimerInterval = setInterval(() => {
                if (localSeconds > 0) {
                    localSeconds--;
                    updateTimerText(localSeconds);
                } else {
                    clearInterval(window.gameTimerInterval);
                }
            }, 1000);
        }

        // Helper function to format 00:00
        function updateTimerText(seconds) {
            const timerDisplay = document.getElementById('timer');
            if (!timerDisplay) return;
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            timerDisplay.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        }
    }

    gameSocket.onStateUpdate = (state) => {
        if (typeof handleGameStateUpdate === 'function') {
            handleGameStateUpdate(state);
        }
    };

    gameSocket.onError = (msg) => {
        if (window.showError) window.showError(msg);
        else alert(msg);
    };

    // 4. Initialize UI Event Listeners
    setupTradeEventListeners();
});

function setupTradeEventListeners() {
    const btnBuy = document.getElementById('btnBuy');
    const btnSell = document.getElementById('btnSell');
    const stockSelect = document.getElementById('stockSelect');
    const amountInput = document.querySelector('.amount-input');
    const btnDone = document.getElementById('btnDoneTrading');
    const btnRoll = document.getElementById('btnRollDice');
    const spinUp = document.querySelector('.spin-up');
    const spinDown = document.querySelector('.spin-down');
    const doneCheckbox = document.getElementById('doneTradingCheckbox');

    // Handle Up Arrow
    if (spinUp) {
        spinUp.addEventListener('click', () => {
            let val = parseInt(amountInput.value) || 0;
            amountInput.value = val + 500; // Stock Ticker usually moves in 500s
        });
    }

    // Handle Down Arrow
    if (spinDown) {
        spinDown.addEventListener('click', () => {
            let val = parseInt(amountInput.value) || 0;
            if (val >= 500) amountInput.value = val - 500;
        });
    }

    if (doneCheckbox) {
        doneCheckbox.addEventListener('change', function() {
            if (this.checked) {
                // Trigger the socket emit
                gameSocket.markDoneTrading();

                // Visually "lock" the UI immediately for responsiveness
                this.disabled = true;
                const box = this.parentElement.querySelector('.checkbox-box');
                if (box) box.classList.add('checked');

                const label = document.querySelector('.checkbox-header label');
                if (label) label.textContent = 'Trading Complete';
            }
        });
    }

    if (btnBuy) {
        btnBuy.addEventListener('click', (e) => {
            e.preventDefault();
            gameSocket.buyShares(stockSelect.value, parseInt(amountInput.value));
        });
    }

    if (btnSell) {
        btnSell.addEventListener('click', (e) => {
            e.preventDefault();
            gameSocket.sellShares(stockSelect.value, parseInt(amountInput.value));
        });
    }

    if (btnDone) {
        btnDone.addEventListener('click', () => gameSocket.markDoneTrading());
    }

    if (btnRoll) {
        btnRoll.addEventListener('click', () => gameSocket.rollDice());
    }

    // Quick Buttons (500, 1K, etc)
    document.querySelectorAll('.qty-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (amountInput) amountInput.value = btn.getAttribute('data-amount');
        });
    });

    console.log("✅ Event Listeners Attached to:", {
        buy: !!document.getElementById('btnBuy'),
        sell: !!document.getElementById('btnSell'),
        roll: !!document.getElementById('btnRollDice')
    });
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (gameSocket) {
        gameSocket.disconnect();
    }
});