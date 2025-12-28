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
window.stockPrices = {};

document.addEventListener('DOMContentLoaded', () => {
    console.log('🎮 Initializing UI Logic...');

    // Initialize from PHP data
    if (window.initialDiceResults) {
        console.log('Initial dice results found:', window.initialDiceResults);
        setTimeout(() => {
            const dice = window.initialDiceResults;
            queueDiceRoll(dice.stock, dice.action, dice.amount);
        }, 1000);
    }

    // Initialize history
    if (window.initialHistory && window.initialHistory.length > 0) {
        renderHistory(window.initialHistory);
    }

    // 1. Establish the connection first
    gameSocket.connect();

    // 2. Set up the data and Join
    if (window.gameId && window.currentPlayerId) {
        gameSocket.gameId = window.gameId;
        gameSocket.playerId = window.currentPlayerId;

        if (window.currentPlayerSlot !== undefined && window.currentPlayerSlot !== null) {
            gameSocket.playerSlot = parseInt(window.currentPlayerSlot);
        }

        console.log("Setting up game:", gameSocket.gameId, "Slot:", gameSocket.playerSlot);
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

    // Setup dice roll listener - HANDLES AUTO-ROLLS TOO
    gameSocket.onDiceRolled = (data) => {
        console.log('🎲 Dice rolled event received:', data);
        const stock = data.stock || data.stock_die || '';
        const action = data.action || data.action_die || '';
        const amount = data.amount || data.amount_die || '';
        const isAutoRoll = data.auto || false;

        if (isAutoRoll) {
            console.log('🤖 Auto-roll detected');
        }

        queueDiceRoll(stock, action, amount);
    };

    // Setup phase change listener - REQUEST STATE IMMEDIATELY
    gameSocket.onPhaseChanged = (data) => {
        console.log('🔄 Phase changed event:', data);
        playSound('ui/phaseChange');

        // Immediately request fresh state
        if (gameSocket.isConnected()) {
            gameSocket.requestState();
        }
    };

    // Setup state update
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
    initCostDisplayListeners();
    initializeHistoryScroll();

    // 5. Set up initial displays
    setTimeout(() => {
        updateCostDisplay();
        if (window.currentStockPrices && Object.keys(window.currentStockPrices).length > 0) {
            updateStockDisplay(window.currentStockPrices);
        }
        updateRollButton();
        updateDoneTradingDisplay();
    }, 200);

    console.log('✅ UI Logic Initialized');
});

function updatePlayerCardsUI(players, stocks) {
    const container = document.querySelector('.players-container');
    if (!container) return;

    let html = '';

    Object.keys(players).forEach(slot => {
        const p = players[slot];
        if (!p.player_id) return;

        const isMe = (window.currentPlayerName === p.name);
        const isOff = p.has_left || false;
        const isDone = p.done_trading || false;

        const cardClass = `player-card ${isMe ? 'current-player' : ''} ${isOff ? 'disconnected' : ''}`;

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

    const isMyTurn = (window.currentTurn == window.currentPlayerSlot);
    const isDicePhase = (window.currentPhase === 'dice');

    console.log('🎲 Updating roll button:', {
        isMyTurn,
        isDicePhase,
        currentTurn: window.currentTurn,
        playerSlot: window.currentPlayerSlot,
        currentPhase: window.currentPhase
    });

    if (!isMyTurn) {
        btnRoll.disabled = true;
        btnRoll.textContent = '⏳ Not Your Turn';
        btnRoll.classList.remove('active-roll');
        btnRoll.classList.add('inactive-roll');
        btnRoll.setAttribute('title', `Waiting for Player ${window.currentTurn + 1}'s turn...`);
        window.lastRollButtonState = 'not-my-turn';
        return;
    }

    if (isDicePhase) {
        btnRoll.disabled = false;
        btnRoll.textContent = '🎲 ROLL!';
        btnRoll.classList.add('active-roll');
        btnRoll.classList.remove('inactive-roll');
        btnRoll.setAttribute('title', 'Click to roll the dice!');

        if (window.lastRollButtonState !== 'active') {
            console.log('🔔 Playing your turn sound');
            playSound('ui/yourTurn');
        }
        window.lastRollButtonState = 'active';
    } else {
        btnRoll.disabled = true;
        btnRoll.textContent = '⏳ Trading Phase';
        btnRoll.classList.remove('active-roll');
        btnRoll.classList.add('inactive-roll');
        btnRoll.setAttribute('title', 'Waiting for trading phase to end...');
        window.lastRollButtonState = 'trading';
    }
}

function handleGameStateUpdate(state) {
    console.log("📥 Received new game state:", state);

    const previousPhase = window.currentPhase;
    const previousTurn = window.currentTurn;

    window.currentPhase = state.current_phase;
    window.currentTurn = state.current_turn;

    // Detect phase change
    if (previousPhase && previousPhase !== window.currentPhase) {
        console.log(`🔄 Phase changed: ${previousPhase} → ${window.currentPhase}`);
        handlePhaseChange(previousPhase, window.currentPhase);
    }

    // Detect turn change
    if (previousTurn !== undefined && previousTurn !== window.currentTurn) {
        console.log(`👉 Turn changed: ${previousTurn} → ${window.currentTurn}`);
    }

    // Update stock prices globally
    if (state.stocks) {
        window.currentStockPrices = state.stocks;
        window.stockPrices = state.stocks;
        updateStockDisplay(state.stocks);
    }

    // Update player cards
    if (state.players) {
        updatePlayerCardsUI(state.players, state.stocks);

        const mySlot = window.currentPlayerSlot.toString();
        if (state.players[mySlot]) {
            window.currentPlayerCash = state.players[mySlot].cash || 0;

            // Update done trading state for current player
            const myDoneTrading = state.players[mySlot].done_trading || false;
            updateDoneTradingCheckbox(myDoneTrading);
        }
    }

    // Update history
    if (state.history) {
        renderHistory(state.history);
    }

    // Update roll button (ALWAYS call this on state update)
    updateRollButton();

    // Update phase label in header
    updatePhaseLabel(state.current_phase);

    // Update done trading count
    updateDoneTradingCount(state);

    // Update timer display
    updateTimerDisplay(state);

    // Update turn status
    updateTurnStatus(state);

    // Update cost display
    setTimeout(() => updateCostDisplay(), 100);
}

function updatePhaseLabel(phase) {
    const phaseLabel = document.querySelector('.phase-label');
    if (phaseLabel) {
        phaseLabel.className = `phase-label ${phase}`;
        phaseLabel.textContent = phase === 'trading' ? '🔄 TRADING' : '🎲 DICE';
    }
}

function updateDoneTradingCount(state) {
    const playersStatus = document.querySelector('.players-status');
    if (!playersStatus) return;

    if (state.current_phase === 'trading') {
        const doneCount = state.done_trading_count || 0;
        const activeCount = state.active_player_count || 0;
        playersStatus.textContent = `${doneCount}/${activeCount} Ready`;
        playersStatus.style.display = '';
    } else {
        playersStatus.style.display = 'none';
    }
}

function updateTurnStatus(state) {
    const turnStatus = document.querySelector('.turn-status');
    if (!turnStatus) return;

    if (state.current_phase === 'dice') {
        const isMyTurn = (state.current_turn == window.currentPlayerSlot);
        turnStatus.innerHTML = isMyTurn
            ? '<span class="your-turn-pulse">YOUR TURN</span>'
            : 'WAITING...';
        turnStatus.style.display = '';
    } else {
        turnStatus.style.display = 'none';
    }
}

function updateTimerDisplay(state) {
    const timerDisplay = document.getElementById('timer');
    if (!timerDisplay || state.time_remaining === undefined) return;

    const totalSeconds = Math.floor(state.time_remaining);

    // Clear existing interval
    if (window.gameTimerInterval) {
        clearInterval(window.gameTimerInterval);
    }

    // Initial display
    updateTimerText(totalSeconds);

    // Start countdown
    let localSeconds = totalSeconds;
    window.gameTimerInterval = setInterval(() => {
        if (localSeconds > 0) {
            localSeconds--;
            updateTimerText(localSeconds);
        } else {
            // Timer expired
            clearInterval(window.gameTimerInterval);
            console.log('⏰ Timer expired! Requesting state update...');

            // Request fresh state to check for phase change
            if (gameSocket && gameSocket.isConnected()) {
                gameSocket.requestState();
            }
        }
    }, 1000);

    function updateTimerText(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        timerDisplay.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

        // Visual warning when time is running low
        if (seconds <= 10 && seconds > 0) {
            timerDisplay.style.color = '#ef4444';
            timerDisplay.style.fontWeight = 'bold';
        } else {
            timerDisplay.style.color = '';
            timerDisplay.style.fontWeight = '';
        }
    }
}

function handlePhaseChange(oldPhase, newPhase) {
    console.log(`🎯 Handling phase change: ${oldPhase} → ${newPhase}`);

    playSound('ui/phaseChange');

    if (newPhase === 'trading') {
        resetDoneTradingCheckbox();
        enableTradingControls();
        console.log('✅ Entered trading phase - controls enabled');
    } else if (newPhase === 'dice') {
        disableTradingControls();
        console.log('🎲 Entered dice phase - trading disabled');
    }
}

function resetDoneTradingCheckbox() {
    const checkbox = document.getElementById('doneTradingCheckbox');
    const checkboxBox = document.querySelector('.checkbox-box');
    const checkboxHeader = document.querySelector('.checkbox-header label');
    const doneControl = document.querySelector('.done-trading-control');

    if (checkbox) {
        checkbox.checked = false;
        checkbox.disabled = false;
    }

    if (checkboxBox) {
        checkboxBox.classList.remove('checked');
    }

    if (checkboxHeader) {
        checkboxHeader.textContent = 'Done Trading?';
    }

    if (doneControl) {
        doneControl.classList.remove('checked');
    }

    console.log('✅ Done trading checkbox reset');
}

function updateDoneTradingCheckbox(isDone) {
    const checkbox = document.getElementById('doneTradingCheckbox');
    const checkboxBox = document.querySelector('.checkbox-box');
    const checkboxHeader = document.querySelector('.checkbox-header label');
    const doneControl = document.querySelector('.done-trading-control');

    if (isDone) {
        if (checkbox) {
            checkbox.checked = true;
            checkbox.disabled = true;
        }

        if (checkboxBox) {
            checkboxBox.classList.add('checked');
        }

        if (checkboxHeader) {
            checkboxHeader.textContent = 'Trading Complete';
        }

        if (doneControl) {
            doneControl.classList.add('checked');
        }
    }
}

function updateDoneTradingDisplay() {
    // Initial setup from PHP state
    const checkbox = document.getElementById('doneTradingCheckbox');
    if (checkbox && checkbox.checked) {
        const checkboxBox = document.querySelector('.checkbox-box');
        const checkboxHeader = document.querySelector('.checkbox-header label');

        if (checkboxBox) checkboxBox.classList.add('checked');
        if (checkboxHeader) checkboxHeader.textContent = 'Trading Complete';
    }
}

function enableTradingControls() {
    const stockSelect = document.getElementById('stockSelect');
    const btnBuy = document.getElementById('btnBuy');
    const btnSell = document.getElementById('btnSell');
    const qtyButtons = document.querySelectorAll('.qty-btn');
    const spinButtons = document.querySelectorAll('.spin-btn');
    const actionForm = document.querySelector('.action-form');
    const doneCheckbox = document.getElementById('doneTradingCheckbox');

    if (stockSelect) stockSelect.disabled = false;
    if (btnBuy) btnBuy.disabled = false;
    if (btnSell) btnSell.disabled = false;
    if (doneCheckbox && !doneCheckbox.checked) doneCheckbox.disabled = false;

    qtyButtons.forEach(btn => btn.disabled = false);
    spinButtons.forEach(btn => btn.disabled = false);

    if (actionForm) {
        actionForm.classList.remove('form-disabled');
    }
}

function disableTradingControls() {
    const stockSelect = document.getElementById('stockSelect');
    const btnBuy = document.getElementById('btnBuy');
    const btnSell = document.getElementById('btnSell');
    const qtyButtons = document.querySelectorAll('.qty-btn');
    const spinButtons = document.querySelectorAll('.spin-btn');
    const actionForm = document.querySelector('.action-form');

    if (stockSelect) stockSelect.disabled = true;
    if (btnBuy) btnBuy.disabled = true;
    if (btnSell) btnSell.disabled = true;

    qtyButtons.forEach(btn => btn.disabled = true);
    spinButtons.forEach(btn => btn.disabled = true);

    if (actionForm) {
        actionForm.classList.add('form-disabled');
    }
}

function setupTradeEventListeners() {
    const btnBuy = document.getElementById('btnBuy');
    const btnSell = document.getElementById('btnSell');
    const stockSelect = document.getElementById('stockSelect');
    const amountInput = document.querySelector('.amount-input');
    const btnRoll = document.getElementById('btnRollDice');
    const spinUp = document.querySelector('.spin-up');
    const spinDown = document.querySelector('.spin-down');
    const doneCheckbox = document.getElementById('doneTradingCheckbox');

    if (spinUp) {
        spinUp.addEventListener('click', () => {
            let val = parseInt(amountInput.value) || 0;
            amountInput.value = val + 500;
            updateCostDisplay();
        });
    }

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
                gameSocket.markDoneTrading();

                this.disabled = true;
                const box = this.parentElement.querySelector('.checkbox-box');
                if (box) box.classList.add('checked');

                const label = document.querySelector('.checkbox-header label');
                if (label) label.textContent = 'Trading Complete';

                disableTradingControls();
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

    if (btnRoll) {
        btnRoll.addEventListener('click', () => {
            const isMyTurn = (window.currentTurn == window.currentPlayerSlot);
            const isDicePhase = (window.currentPhase === 'dice');

            if (!isMyTurn || !isDicePhase) {
                console.warn('Attempted to roll when not allowed');
                return;
            }

            btnRoll.classList.add('rolling-clicked');
            setTimeout(() => btnRoll.classList.remove('rolling-clicked'), 300);

            playSound('ui/click');
            gameSocket.rollDice();

            btnRoll.disabled = true;
            btnRoll.textContent = '🎲 Rolling...';

            window.rollButtonTimeout = setTimeout(() => {
                updateRollButton();
            }, 5000);
        });
    }

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
        setTimeout(() => updateStockSelectColor(), 100);
    }

    console.log("✅ Event Listeners Attached");
}

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

function updateStockDisplay(stocks) {
    console.log('Updating stock prices display:', stocks);

    Object.keys(stocks).forEach(stockName => {
        const priceCents = Math.round((stocks[stockName] || 1) * 100);

        let displayName = stockName;
        if (stockName === 'Industrials') {
            displayName = 'Indust.';
        }

        const stockCells = document.querySelectorAll(`td[data-stock="${displayName}"]`);

        stockCells.forEach(cell => {
            cell.classList.remove('current-price');
            const marker = cell.querySelector('.price-marker');
            if (marker) {
                marker.remove();
            }
        });

        let targetPrice = Math.round(priceCents / 5) * 5;
        targetPrice = Math.max(0, Math.min(200, targetPrice));

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

function updateCostDisplay() {
    const stockSelect = document.getElementById('stockSelect');
    const amountInput = document.querySelector('.amount-input');
    const costDisplay = document.getElementById('costDisplay');

    if (!stockSelect || !amountInput || !costDisplay) return;

    const selectedStock = stockSelect.value;
    const amount = parseInt(amountInput.value) || 0;
    const stockPrice = window.currentStockPrices[selectedStock] || 1.00;
    const totalCost = amount * stockPrice;

    costDisplay.value = `COST: $${totalCost.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;

    if (window.currentPlayerCash !== undefined && totalCost > window.currentPlayerCash && amount > 0) {
        costDisplay.style.color = '#ef4444';
        costDisplay.style.fontWeight = 'bold';
    } else {
        costDisplay.style.color = '';
        costDisplay.style.fontWeight = '';
    }
}

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
    const text = document.getElementById('dice-text');

    if (!overlay) return;

    isShaking = true;
    animationInProgress = true;
    overlay.style.display = 'flex';

    dice.forEach(d => {
        if (d) {
            d.classList.remove('die-reveal');
            d.classList.add('rolling');
            d.innerText = '?';
        }
    });

    if (text) {
        text.classList.remove('reveal-text');
        text.innerText = 'Rolling...';
    }

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

    // Always start fresh
    startInstantShaking();

    setTimeout(() => {
        revealWhenReady(stock, action, amount, callback);
    }, 1000);
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
            // PROPERLY HIDE AND RESET OVERLAY
            const overlay = document.getElementById('dice-overlay');
            if (overlay) {
                overlay.style.display = 'none';
            }

            // Reset dice for next animation
            Object.values(dice).forEach(d => {
                if (d) {
                    d.classList.remove('die-reveal', 'rolling');
                    d.innerText = '?';
                }
            });

            if (text) {
                text.classList.remove('reveal-text');
                text.innerText = 'Rolling...';
            }

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

/* ===== HISTORY ===== */
function initializeHistoryScroll() {
    const historyContent = document.getElementById('historyContent');
    if (!historyContent) return;

    historyContent.scrollTop = historyContent.scrollHeight;

    historyContent.addEventListener('scroll', function() {
        const isNearBottom = this.scrollHeight - this.scrollTop - this.clientHeight < 10;
        window.isUserScrolled = !isNearBottom;
    });
}

function renderHistory(history) {
    const historyContent = document.getElementById('historyContent');
    if (!historyContent) return;

    if (!history || history.length === 0) {
        historyContent.innerHTML = '<div class="history-empty">No events yet...</div>';
        return;
    }

    let html = '';

    history.forEach(entry => {
        if (typeof entry === 'string') {
            html += `<div class="history-item">${entry}</div>`;
        } else {
            const type = entry.type || 'event';
            const timestamp = entry.timestamp ? new Date(entry.timestamp * 1000).toLocaleTimeString() : '';
            const message = entry.message || entry;
            html += `<div class="history-entry event-${type}">${timestamp ? '[' + timestamp + '] ' : ''}${message}</div>`;
        }
    });

    const wasAtBottom = historyContent.scrollHeight - historyContent.scrollTop - historyContent.clientHeight < 10;
    historyContent.innerHTML = html;

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

window.showError = showError;

window.addEventListener('beforeunload', () => {
    if (gameSocket) {
        gameSocket.disconnect();
    }
});