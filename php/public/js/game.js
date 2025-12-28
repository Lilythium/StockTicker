/* ===== js/game.js ===== */
const AUDIO_PATHS = {
    shakes: [
        '/stock_ticker/audio/dice_shakes/shuffle_open_1.mp3',
        '/stock_ticker/audio/dice_shakes/shuffle_open_2.mp3',
        '/stock_ticker/audio/dice_shakes/shuffle_open_3.mp3',
        '/stock_ticker/audio/dice_shakes/shuffle_open_4.mp3'
    ],
    lands: [
        '/stock_ticker/audio/dice_lands/d6_floor_1.mp3',
        '/stock_ticker/audio/dice_lands/d6_floor_2.mp3',
        '/stock_ticker/audio/dice_lands/d6_floor_3.mp3',
        '/stock_ticker/audio/dice_lands/d6_floor_4.mp3'
    ],
    ui: {
        click: '/stock_ticker/audio/button-click.ogg',
        gameOver: '/stock_ticker/audio/game-complete.mp3',
        phaseChange: '/stock_ticker/audio/game-phase-change.mp3',
        gameStart: '/stock_ticker/audio/game-start.mp3',
        yourTurn: '/stock_ticker/audio/your-turn.mp3'
    }
};

/* ===== HELPER FUNCTIONS ===== */
function formatMoney(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

function playSound(pathOrCategory) {
    let file;
    if (AUDIO_PATHS[pathOrCategory]) {
        const entry = AUDIO_PATHS[pathOrCategory];
        file = Array.isArray(entry) ? entry[Math.floor(Math.random() * entry.length)] : entry;
    } else {
        file = pathOrCategory;
    }
    const audio = new Audio(file);
    audio.play().catch(e => console.log("Audio blocked: " + file));
    return audio;
}

let isShaking = false;
let animationInProgress = false;

// Create global instance
if (!window.gameSocket) {
    window.gameSocket = new GameSocketClient();

    if (window.gameId) gameSocket.gameId = window.gameId;
    if (window.currentPlayerId) gameSocket.playerId = window.currentPlayerId;
    if (window.currentPlayerSlot !== undefined) gameSocket.playerSlot = parseInt(window.currentPlayerSlot);
}

// Store current stock prices globally
window.currentStockPrices = {};
window.currentPlayerCash = 0;
window.stockPrices = {}; // For dice animation compatibility

document.addEventListener('DOMContentLoaded', () => {
    console.log('🎮 Initializing UI Logic...');

    // Initialize from PHP data
    if (window.initialDiceResults) {
        console.log('Initial dice results found:', window.initialDiceResults);
        // Show initial dice results after a short delay
        setTimeout(() => {
            showDiceRollAnimation(window.initialDiceResults);
        }, 1000);
    }

    // Initialize history
    if (window.initialHistory && window.initialHistory.length > 0) {
        renderHistory(window.initialHistory);
    }

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

    // Setup dice roll listener - FIXED: Use queue system
    gameSocket.onDiceRolled = (data) => {
        console.log('🎲 Dice rolled event received:', data);
        // Extract values from data structure
        const stock = data.stock || data.stock_die || '';
        const action = data.action || data.action_die || '';
        const amount = data.amount || data.amount_die || '';

        // Queue the dice roll for animation
        queueDiceRoll(stock, action, amount);
    };

    // Setup state update to handle stock prices and cost
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

    // 5. Initialize cost display listeners
    initCostDisplayListeners();

    // 6. Initialize history and timer
    initializeHistoryScroll();

    // 7. Set up initial cost display
    setTimeout(() => {
        updateCostDisplay();
        // Also update stock display with initial data
        if (window.currentStockPrices && Object.keys(window.currentStockPrices).length > 0) {
            updateStockDisplay(window.currentStockPrices);
        }
    }, 200);
    setTimeout(() => updateRollButton(), 200);
    console.log('✅ UI Logic Initialized');
});

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

function updateRollButton() {
    const btnRoll = document.getElementById('btnRollDice');
    if (!btnRoll) return;

    // Get current values
    const isMyTurn = (window.currentTurn == window.currentPlayerSlot);
    const isDicePhase = (window.currentPhase === 'dice');

    console.log('Updating roll button:', {
        isMyTurn,
        isDicePhase,
        currentTurn: window.currentTurn,
        playerSlot: window.currentPlayerSlot,
        currentPhase: window.currentPhase
    });

    // Button is enabled ONLY when it's your turn AND it's the dice phase
    const shouldBeEnabled = (isMyTurn && isDicePhase);

    // Always disable if not your turn
    if (!isMyTurn) {
        btnRoll.disabled = true;
        btnRoll.textContent = '⏳ Not Your Turn';
        btnRoll.classList.remove('active-roll');
        btnRoll.classList.add('inactive-roll');
        btnRoll.setAttribute('title', `Waiting for Player ${window.currentTurn + 1}'s turn...`);
        return;
    }

    // If it is your turn, check the phase
    if (isDicePhase) {
        // Your turn AND dice phase = enabled
        btnRoll.disabled = false;
        btnRoll.textContent = '🎲 ROLL!';
        btnRoll.classList.add('active-roll');
        btnRoll.classList.remove('inactive-roll');
        btnRoll.setAttribute('title', 'Click to roll the dice!');

        // Play your turn sound if just became your turn
        if (window.lastRollButtonState !== 'active') {
            playSound('ui/yourTurn');
        }
        window.lastRollButtonState = 'active';
    } else {
        // Your turn but not dice phase (trading phase) = disabled
        btnRoll.disabled = true;
        btnRoll.textContent = '⏳ Trading Phase';
        btnRoll.classList.remove('active-roll');
        btnRoll.classList.add('inactive-roll');
        btnRoll.setAttribute('title', 'Waiting for trading phase to end...');
        window.lastRollButtonState = 'inactive';
    }
}

function handleGameStateUpdate(state) {
    console.log("📥 Received new game state:", state);

    window.currentPhase = state.current_phase;
    window.currentTurn = state.current_turn;

    // Update stock prices globally
    if (state.stocks) {
        window.currentStockPrices = state.stocks;
        window.stockPrices = state.stocks;
        updateStockDisplay(state.stocks);
    }

    // 1. Update Cash & Portfolio on Player Cards
    if (state.players) {
        updatePlayerCardsUI(state.players, state.stocks);
    }

    // 2. Update Game History
    if (state.history) {
        renderHistory(state.history);
    }

    // 3. Update Roll Button
    updateRollButton();

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

    // Update cost display after state update
    setTimeout(() => updateCostDisplay(), 100);

    // Helper function to format 00:00
    function updateTimerText(seconds) {
        const timerDisplay = document.getElementById('timer');
        if (!timerDisplay) return;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        timerDisplay.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

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
            updateCostDisplay();
        });
    }

    // Handle Down Arrow
    if (spinDown) {
        spinDown.addEventListener('click', () => {
            let val = parseInt(amountInput.value) || 0;
            if (val >= 500) amountInput.value = val - 500;
            updateCostDisplay();
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
        btnRoll.addEventListener('click', () => {
            const isMyTurn = (window.currentTurn == window.currentPlayerSlot);
            const isDicePhase = (window.currentPhase === 'dice');

            if (!isMyTurn || !isDicePhase) {
                console.warn('Attempted to roll when not allowed');
                return;
            }
            // Add visual feedback
            btnRoll.classList.add('rolling-clicked');
            setTimeout(() => btnRoll.classList.remove('rolling-clicked'), 300);

            // Play click sound
            playSound('ui/click');

            // Call the socket function
            gameSocket.rollDice();

            // Immediately disable button to prevent multiple clicks
            btnRoll.disabled = true;
            btnRoll.textContent = '🎲 Rolling...';

            window.rollButtonTimeout = setTimeout(() => {
                // Only re-enable if still your turn and dice phase
                if (window.currentTurn == window.currentPlayerSlot && window.currentPhase === 'dice') {
                    btnRoll.disabled = false;
                    btnRoll.textContent = '🎲 ROLL!';
                }
            }, 5000);
        });
    }

    // Quick Buttons (500, 1K, etc)
    document.querySelectorAll('.qty-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (amountInput) {
                amountInput.value = btn.getAttribute('data-amount');
                updateCostDisplay();
            }
        });
    });

    if (stockSelect) {
        stockSelect.addEventListener('change', updateStockSelectColor);

        // Apply initial color on page load
        setTimeout(() => updateStockSelectColor(), 100);
    }

    console.log("✅ Event Listeners Attached to:", {
        buy: !!document.getElementById('btnBuy'),
        sell: !!document.getElementById('btnSell'),
        roll: !!document.getElementById('btnRollDice')
    });
}

/* ===== STOCK SELECT COLOR HIGHLIGHTING ===== */

function updateStockSelectColor() {
    const stockSelect = document.getElementById('stockSelect');
    if (!stockSelect) return;
    const selectedStock = stockSelect.value;

    const stockClassMap = {
        'Gold': 'select-gold',
        'Silver': 'select-silver',
        'Oil': 'select-oil',
        'Bonds': 'select-bonds',
        'Industrials': 'select-industrials',
        'Grain': 'select-grain'
    };

    Object.values(stockClassMap).forEach(className => {
        stockSelect.classList.remove(className);
    });

    const selectedClass = stockClassMap[selectedStock];
    if (selectedClass) {
        stockSelect.classList.add(selectedClass);
    }
}

/* ===== STOCK PRICE DISPLAY FUNCTIONS ===== */

function updateStockDisplay(stocks) {
    console.log('Updating stock prices display:', stocks);

    Object.keys(stocks).forEach(stockName => {
        // Convert dollar price to cents for display
        const priceCents = Math.round((stocks[stockName] || 1) * 100);

        // Handle different stock name formats
        let displayName = stockName;
        if (stockName === 'Industrials') {
            displayName = 'Indust.';
        }

        // Find all price cells for this stock
        const stockCells = document.querySelectorAll(`td[data-stock="${displayName}"]`);

        // Remove current-price class from all cells
        stockCells.forEach(cell => {
            cell.classList.remove('current-price');
            const marker = cell.querySelector('.price-marker');
            if (marker) {
                marker.remove();
            }
        });

        // Find the cell at the correct price position (every 5 cents)
        let targetPrice = Math.round(priceCents / 5) * 5;
        targetPrice = Math.max(0, Math.min(200, targetPrice)); // Clamp to 0-200

        // Find the target cell
        const targetCell = document.querySelector(`td[data-stock="${displayName}"][data-price="${targetPrice}"]`);
        if (targetCell) {
            targetCell.classList.add('current-price');
            const marker = document.createElement('div');
            marker.className = 'price-marker';
            marker.textContent = targetPrice;
            targetCell.appendChild(marker);
        }
    });
}

/* ===== COST DISPLAY FUNCTION ===== */

function updateCostDisplay() {
    const stockSelect = document.getElementById('stockSelect');
    const amountInput = document.querySelector('.amount-input');
    const costDisplay = document.getElementById('costDisplay');

    if (!stockSelect || !amountInput || !costDisplay) return;

    const selectedStock = stockSelect.value;
    const amount = parseInt(amountInput.value) || 0;
    const stockPrice = window.currentStockPrices[selectedStock] || 1.00;
    const totalCost = amount * stockPrice;

    // Format the display
    costDisplay.value = `COST: $${totalCost.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;

    // Add visual feedback if cost exceeds cash
    if (window.currentPlayerCash !== undefined && totalCost > window.currentPlayerCash && amount > 0) {
        costDisplay.style.color = '#ef4444';
        costDisplay.style.fontWeight = 'bold';
    } else {
        costDisplay.style.color = '';
        costDisplay.style.fontWeight = '';
    }
}

/* ===== COST DISPLAY LISTENERS ===== */

function initCostDisplayListeners() {
    const stockSelect = document.getElementById('stockSelect');
    const amountInput = document.querySelector('.amount-input');

    if (stockSelect) {
        stockSelect.addEventListener('change', () => updateCostDisplay());
    }

    if (amountInput) {
        amountInput.addEventListener('input', () => updateCostDisplay());
        amountInput.addEventListener('change', () => updateCostDisplay());
    }

    // Initial cost display update
    setTimeout(() => updateCostDisplay(), 100);

    console.log('✅ Cost display listeners initialized');
}

/* ===== DICE ANIMATION ===== */
let diceRollQueue = [];
let isProcessingRoll = false;

function queueDiceRoll(stock, action, amount) {
    console.log('🎲 Queueing dice roll:', { stock, action, amount });
    diceRollQueue.push({ stock, action, amount });
    processNextRoll();
}

function processNextRoll() {
    if (isProcessingRoll || diceRollQueue.length === 0) return;

    isProcessingRoll = true;
    const roll = diceRollQueue.shift();

    showRollAnimation(roll.stock, roll.action, roll.amount, () => {
        isProcessingRoll = false;

        if (diceRollQueue.length > 0) {
            setTimeout(() => processNextRoll(), 500);
        } else {
            // Animation complete, reset roll button
            const rollBtn = document.querySelector('.btn-roll-ready');
            if (rollBtn) {
                rollBtn.disabled = false;
                rollBtn.innerHTML = window.isYourTurn ? '🎲 ROLL!' : '⏳ Waiting...';
            }
        }
    });
}

function startInstantShaking() {
    const overlay = document.getElementById('dice-overlay');
    const dice = [
        document.getElementById('die-stock'),
        document.getElementById('die-action'),
        document.getElementById('die-amount')
    ];

    if (!overlay) return;

    isShaking = true;

    animationInProgress = true;
    overlay.style.display = 'flex';

    dice.forEach(d => {
        if (d) {
            d.classList.add('rolling');
            d.innerText = '?';
        }
    });

    // Start shake sound
    playShakeSounds();
}

function playShakeSounds() {
    if (!isShaking) return;

    const snd = playSound('shakes');
    snd.volume = Math.random() * (1.0 - 0.7) + 0.7;

    const nextGap = Math.random() * 50 + 40;
    setTimeout(playShakeSounds, nextGap);
}

function showRollAnimation(stock, action, amount, callback) {
    console.log('🎲 Starting dice animation:', { stock, action, amount });

    if (!animationInProgress) {
        startInstantShaking();
        setTimeout(() => {
            revealWhenReady(stock, action, amount, callback);
        }, 1000);
    } else {
        revealWhenReady(stock, action, amount, callback);
    }
}

async function revealWhenReady(stock, action, amount, callback) {
    const dice = {
        stock: document.getElementById('die-stock'),
        action: document.getElementById('die-action'),
        amount: document.getElementById('die-amount')
    };
    const text = document.getElementById('dice-text');

    setTimeout(() => {
        revealDie(dice.stock, (stock === "Industrials" ? "Indust." : stock).toUpperCase());
    }, 200);

    setTimeout(() => {
        revealDie(dice.action, action.toUpperCase());
    }, 500);
    isShaking = false;
    setTimeout(() => {
        revealDie(dice.amount, amount + '¢');

        if (text) {
            text.classList.add('reveal-text');
            if (action.toUpperCase() === "DIV") {
                // Check if stock price is above $1.00
                const stockPrice = window.stockPrices[stock] || 0;
                if (stockPrice > 1.00) {
                    text.innerText = `${stock} ${action.toUpperCase()} ${amount}¢!`;
                } else {
                    text.innerText = `Dividends for ${stock} not payable.`;
                }
            } else {
                text.innerText = `${stock} went ${action.toUpperCase()} ${amount}¢!`;
            }
        }

        setTimeout(() => {
            const overlay = document.getElementById('dice-overlay');
            if (overlay) overlay.style.display = 'none';
            animationInProgress = false;

            if (callback) callback();
        }, 1500);
    }, 800);
}

function revealDie(el, val) {
    playSound('lands');
    if (!el) return;
    el.classList.remove('rolling');
    el.classList.add('die-reveal');
    el.innerText = val;
}

/* ===== HISTORY & TIMER ===== */

function initializeHistoryScroll() {
    const historyContent = document.getElementById('historyContent');
    if (!historyContent) return;

    // Set initial scroll to bottom
    historyContent.scrollTop = historyContent.scrollHeight;

    historyContent.addEventListener('scroll', function() {
        const isNearBottom = this.scrollHeight - this.scrollTop - this.clientHeight < 10;
        window.isUserScrolled = !isNearBottom;
    });
}

function renderHistory(history) {
    const historyContent = document.getElementById('historyContent');
    if (!historyContent) return;

    console.log('📜 Rendering history:', history);

    if (!history || history.length === 0) {
        historyContent.innerHTML = '<div class="history-empty">No events yet...</div>';
        return;
    }

    let html = '';

    // Handle both array of strings and array of objects
    history.forEach(entry => {
        if (typeof entry === 'string') {
            // Simple string entry
            html += `<div class="history-item">${entry}</div>`;
        } else {
            // Object entry (from older code)
            const type = entry.type || 'event';
            const timestamp = entry.timestamp ? new Date(entry.timestamp * 1000).toLocaleTimeString() : '';
            const message = entry.message || entry;
            html += `<div class="history-entry event-${type}">${timestamp ? '[' + timestamp + '] ' : ''}${message}</div>`;
        }
    });

    const wasAtBottom = historyContent.scrollHeight - historyContent.scrollTop - historyContent.clientHeight < 10;
    historyContent.innerHTML = html;

    // Auto-scroll to bottom if user wasn't manually scrolling
    if (!window.isUserScrolled || wasAtBottom) {
        historyContent.scrollTop = historyContent.scrollHeight;
    }
}

function toggleHistory() {
    const historyBar = document.getElementById('historyBar');
    const historyContent = document.getElementById('historyContent');

    if (historyBar && historyContent) {
        const wasAtBottom = historyContent.scrollHeight - historyContent.scrollTop - historyContent.clientHeight < 10;
        historyBar.classList.toggle('expanded');
        setTimeout(() => {
            if (wasAtBottom || !window.isUserScrolled) {
                historyContent.scrollTop = historyContent.scrollHeight;
            }
        }, 300);
    }
}
window.toggleHistory = toggleHistory;

function initializeTimer() {
    const timerEl = document.getElementById('timer');
    if (!timerEl) return;

    let remaining = parseInt(timerEl.getAttribute('data-remaining')) || 0;

    setInterval(function() {
        if (remaining > 0) {
            remaining--;
            const mins = Math.floor(remaining / 60);
            const secs = remaining % 60;
            timerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
    }, 1000);
}

/* ===== ERROR DISPLAY ===== */

function showError(message) {
    console.error('❌', message);

    const existingError = document.querySelector('.client-error');
    if (existingError) existingError.remove();

    const errorDiv = document.createElement('div');
    errorDiv.className = 'client-error error';
    errorDiv.innerHTML = `⚠️ ${message}`;
    errorDiv.style.cssText = `
        background: #f8d7da;
        color: #721c24;
        padding: 12px;
        border-radius: 5px;
        margin: 15px 0;
        border: 3px solid #f5c6cb;
        font-weight: bold;
        animation: shake 0.5s;
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 9999;
        max-width: 500px;
    `;

    document.body.appendChild(errorDiv);

    setTimeout(() => {
        errorDiv.style.transition = 'opacity 0.5s';
        errorDiv.style.opacity = '0';
        setTimeout(() => errorDiv.remove(), 500);
    }, 5000);
}

// Make showError global so socket client can use it
window.showError = showError;

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (gameSocket) {
        gameSocket.disconnect();
    }
});