const AUDIO_PATHS = {
    shakes: [
        '../../audio/dice_shakes/shuffle_open_1.mp3',
        '../../audio/dice_shakes/shuffle_open_2.mp3',
        '../../audio/dice_shakes/shuffle_open_3.mp3',
        '../../audio/dice_shakes/shuffle_open_4.mp3'
    ],
    lands: [
        '../../audio/dice_lands/d6_floor_1.mp3',
        '../../audio/dice_lands/d6_floor_2.mp3',
        '../../audio/dice_lands/d6_floor_3.mp3',
        '../../audio/dice_lands/d6_floor_4.mp3'
    ],
    ui: {
        click: '../../audio/button-click.ogg',
        gameOver: '../../audio/game-complete.mp3',
        phaseChange: '../../audio/game-phase-change.mp3',
        gameStart: '../../audio/game-start.mp3',
        yourTurn: '../../audio/your-turn.mp3'
    }
};

/* ===== STATE MANAGEMENT ===== */
let isRedirecting = false;
let lastPhase = null;
let lastTurn = null;
let isShaking = false;
let animationInProgress = false;

// Prevent multiple simultaneous state updates
let isProcessingState = false;
let pendingStateUpdate = null;

/* ===== AUDIO HELPERS ===== */
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

/* ===== INITIALIZATION ===== */
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎮 Initializing Game UI...');

    if (!window.gameSocket) {
        window.gameSocket = new GameSocketClient(window.SOCKETIO_SERVER);
    }

    console.log('Connecting to Socket.IO server...');
    gameSocket.connect();
    setupSocketHandlers();
    setupTradeEventListeners();
    initCostDisplayListeners();
    initializeHistoryScroll();

    console.log('✅ Game UI Initialized');
});

/* ===== SOCKET HANDLERS ===== */
function setupSocketHandlers() {
    if (!gameSocket.socket) {
        console.error("❌ Socket not initialized. Retrying in 100ms...");
        setTimeout(setupSocketHandlers, 100);
        return;
    }

    gameSocket.socket.on('connect', () => {
        console.log('✅ Socket.IO connected! Joining game...');
        gameSocket.joinGame(window.gameId, window.currentPlayerId, window.currentPlayerName);
    });

    gameSocket.socket.on('join_result', (data) => {
        console.log('📥 Join result:', data);
        if (data.success && data.game_state) {
            const state = data.game_state;

            // Identify player slot
            if (state.players) {
                for (const [slot, player] of Object.entries(state.players)) {
                    if (player.player_id === window.currentPlayerId) {
                        window.currentPlayerSlot = parseInt(slot);
                        gameSocket.playerSlot = parseInt(slot);
                        console.log(`✅ Player slot: ${window.currentPlayerSlot}`);
                        break;
                    }
                }
            }

            handleGameStateUpdate(state);
        }
    });

    gameSocket.onStateUpdate = (state) => {
        handleGameStateUpdate(state);
    };

    gameSocket.onDiceRolled = (data) => {
        const stock = data.stock || '';
        const action = data.action || '';
        const amount = data.amount || '';
        queueDiceRoll(stock, action, amount);
    };

    gameSocket.onPhaseChanged = (data) => {
        playSound('ui/phaseChange');
        console.log('🔄 Phase changed:', data);
    };

    gameSocket.onGameOver = (data) => {
        playSound('ui/gameOver');
        setTimeout(() => {
            window.location.href = `game_over.php?game_id=${window.gameId}`;
        }, 2000);
    };
}

/* ===== MAIN STATE HANDLER ===== */
async function handleGameStateUpdate(state) {
    // Queue state updates if one is in progress
    if (isProcessingState) {
        pendingStateUpdate = state;
        return;
    }

    isProcessingState = true;

    try {
        await processGameState(state);
    } catch (error) {
        console.error('❌ Error processing state:', error);
    } finally {
        isProcessingState = false;

        // Process pending update if exists
        if (pendingStateUpdate) {
            const pending = pendingStateUpdate;
            pendingStateUpdate = null;
            setTimeout(() => handleGameStateUpdate(pending), 50);
        }
    }
}

async function processGameState(state) {
    if (!state || isRedirecting) return;

    const isWaitingRoom = window.location.pathname.includes('waiting_room.php');
    const isGamePage = window.location.pathname.includes('game.php');

    console.log("📥 State:", {
        status: state.status,
        phase: state.current_phase,
        round: state.current_round,
        turn: state.current_turn,
        time: state.time_remaining
    });

    // CRITICAL: Handle game over
    if (state.game_over) {
        if (!isRedirecting) {
            isRedirecting = true;
            console.log('🏁 Game over, redirecting...');
            setTimeout(() => {
                window.location.href = `game_over.php?game_id=${window.gameId}`;
            }, 500);
        }
        return;
    }

    // CRITICAL: Handle page redirects
    if (isWaitingRoom && state.status === 'active' && state.current_round >= 1) {
        if (!isRedirecting) {
            isRedirecting = true;
            console.log("🚀 Game starting, redirecting to board...");
            setTimeout(() => {
                window.location.href = 'game.php';
            }, 500);
        }
        return;
    }

    if (isGamePage && state.status === 'waiting' && state.current_round === 0) {
        const pageLoadTime = window.performance?.timing?.navigationStart || Date.now();
        const timeSinceLoad = Date.now() - pageLoadTime;

        if (timeSinceLoad > 2000 && !isRedirecting) {
            isRedirecting = true;
            console.warn("⚠️ Game not started, returning to lobby...");
            setTimeout(() => {
                window.location.href = 'waiting_room.php';
            }, 500);
        }
        return;
    }

    // Identify player slot if not set
    if ((window.currentPlayerSlot === null || window.currentPlayerSlot === undefined) && state.players) {
        for (const [slot, player] of Object.entries(state.players)) {
            if (player.player_id === window.currentPlayerId) {
                window.currentPlayerSlot = parseInt(slot);
                gameSocket.playerSlot = parseInt(slot);
                console.log(`✅ Player slot identified: ${window.currentPlayerSlot}`);
                break;
            }
        }
    }

    // Detect phase/turn changes
    const previousPhase = window.currentPhase;
    const previousTurn = window.currentTurn;

    window.currentPhase = state.current_phase;
    window.currentTurn = state.current_turn;

    if (previousPhase && previousPhase !== window.currentPhase) {
        console.log(`🔄 Phase: ${previousPhase} → ${window.currentPhase}`);
        handlePhaseChange(previousPhase, window.currentPhase);
    }

    if (previousTurn !== undefined && previousTurn !== window.currentTurn) {
        console.log(`👉 Turn: ${previousTurn} → ${window.currentTurn}`);
    }

    // Update UI
    if (state.stocks) {
        window.currentStockPrices = state.stocks;
        window.stockPrices = state.stocks;
        updateStockDisplay(state.stocks);
    }

    if (state.players) {
        updatePlayerCardsUI(state.players, state.stocks);

        const mySlot = window.currentPlayerSlot?.toString();
        if (mySlot && state.players[mySlot]) {
            window.currentPlayerCash = state.players[mySlot].cash || 0;
            const myDoneTrading = state.players[mySlot].done_trading || false;
            updateDoneTradingCheckbox(myDoneTrading);
        }
    }

    if (state.history) {
        renderHistory(state.history);
    }

    updateRollButton();
    updatePhaseLabel(state.current_phase);
    updateDoneTradingCount(state);
    updateTimerDisplay(state);
    updateTurnStatus(state);
    updateRoundDisplay(state);

    // Enable/disable controls
    if (state.current_phase === 'trading') {
        const mySlot = window.currentPlayerSlot?.toString();
        const isDone = mySlot && state.players[mySlot]?.done_trading;

        if (!isDone) {
            enableTradingControls();
        } else {
            disableTradingControls();
        }
    } else if (state.current_phase === 'dice') {
        disableTradingControls();
    }

    setTimeout(() => updateCostDisplay(), 50);
}

/* ===== UI UPDATE FUNCTIONS ===== */
function updateRoundDisplay(state) {
    const roundDisplay = document.querySelector('.round-display');
    if (roundDisplay) {
        const currentRound = state.current_round || 1;
        const maxRounds = state.max_rounds || 15;
        roundDisplay.textContent = `Round ${currentRound}/${maxRounds}`;
    }
}

function updatePlayerCardsUI(players, stocks) {
    const container = document.querySelector('.players-container');
    if (!container) return;

    let html = '';

    Object.keys(players).forEach(slot => {
        const p = players[slot];
        if (!p.player_id) return;

        const isMe = (p.player_id === window.currentPlayerId);
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

    if (!isMyTurn) {
        btnRoll.disabled = true;
        btnRoll.textContent = '⏳ Not Your Turn';
        btnRoll.classList.remove('active-roll');
        btnRoll.classList.add('inactive-roll');
        window.lastRollButtonState = 'not-my-turn';
        return;
    }

    if (isDicePhase) {
        btnRoll.disabled = false;
        btnRoll.textContent = '🎲 ROLL!';
        btnRoll.classList.add('active-roll');
        btnRoll.classList.remove('inactive-roll');

        if (window.lastRollButtonState !== 'active') {
            try {
                const audio = new Audio('/stock_ticker/audio/your-turn.mp3');
                audio.play().catch(e => console.log('Audio blocked'));
            } catch (e) {
                console.log('Could not play sound');
            }
        }
        window.lastRollButtonState = 'active';
    } else {
        btnRoll.disabled = true;
        btnRoll.textContent = '⏳ Trading Phase';
        btnRoll.classList.remove('active-roll');
        btnRoll.classList.add('inactive-roll');
        window.lastRollButtonState = 'trading';
    }
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
        const activeCount = state.connected_player_count || 0;
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

    if (window.gameTimerInterval) {
        clearInterval(window.gameTimerInterval);
    }

    updateTimerText(totalSeconds);

    let localSeconds = totalSeconds;
    window.gameTimerInterval = setInterval(() => {
        if (localSeconds > 0) {
            localSeconds--;
            updateTimerText(localSeconds);
        } else {
            clearInterval(window.gameTimerInterval);

            // Request state update when timer expires
            console.log('⏰ Timer expired, requesting state...');
            if (gameSocket && gameSocket.isConnected()) {
                gameSocket.requestState();
            }
        }
    }, 1000);

    function updateTimerText(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        timerDisplay.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

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
    console.log(`🎯 Phase change: ${oldPhase} → ${newPhase}`);

    try {
        const audio = new Audio('/stock_ticker/audio/game-phase-change.mp3');
        audio.play().catch(e => console.log('Audio blocked'));
    } catch (e) {
        console.log('Could not play sound');
    }

    if (newPhase === 'trading') {
        resetDoneTradingCheckbox();
        enableTradingControls();
    } else if (newPhase === 'dice') {
        disableTradingControls();
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
        checkbox.style.display = 'none';
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

    if (doneCheckbox && !doneCheckbox.checked) {
        doneCheckbox.disabled = false;
    }

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

/* ===== TRADE EVENT LISTENERS ===== */
function setupTradeEventListeners() {
    const btnBuy = document.getElementById('btnBuy');
    const btnSell = document.getElementById('btnSell');
    const stockSelect = document.getElementById('stockSelect');
    const amountInput = document.querySelector('.amount-input');
    const btnRoll = document.getElementById('btnRollDice');
    const spinUp = document.querySelector('.spin-up');
    const spinDown = document.querySelector('.spin-down');
    const doneCheckbox = document.getElementById('doneTradingCheckbox');

    const playClick = () => playSound(AUDIO_PATHS.ui.click);

    if (stockSelect) {
        stockSelect.addEventListener('mousedown', () => {
            if (!stockSelect.disabled) playClick();
        });

        stockSelect.addEventListener('change', () => {
            playClick();
            updateStockSelectColor();
        });
        setTimeout(() => updateStockSelectColor(), 100);
    }

    if (spinUp) {
        spinUp.addEventListener('click', () => {
            playClick();
            let val = parseInt(amountInput.value) || 0;
            amountInput.value = val + 500;
            updateCostDisplay();
        });
    }

    if (spinDown) {
        spinDown.addEventListener('click', () => {
            playClick();
            let val = parseInt(amountInput.value) || 0;
            if (val >= 500) amountInput.value = val - 500;
            updateCostDisplay();
        });
    }

    if (doneCheckbox) {
        doneCheckbox.addEventListener('change', function() {
            if (this.checked) {
                playClick();
                gameSocket.markDoneTrading();
                this.disabled = true;
                const box = this.parentElement.querySelector('.checkbox-box');
                if (box) box.classList.add('checked');
                const label = document.querySelector('.checkbox-header label');
                if (label) label.textContent = 'Trading Complete';
                disableTradingControls();
            }
        });

        const checkboxBox = document.querySelector('.checkbox-box');
        if (checkboxBox) {
            checkboxBox.addEventListener('click', function() {
                if (!doneCheckbox.disabled && !doneCheckbox.checked) {
                    doneCheckbox.checked = true;
                    doneCheckbox.dispatchEvent(new Event('change'));
                }
            });
        }
    }

    if (btnBuy) {
        btnBuy.addEventListener('click', (e) => {
            playClick();
            e.preventDefault();
            gameSocket.buyShares(stockSelect.value, parseInt(amountInput.value));
        });
    }

    if (btnSell) {
        btnSell.addEventListener('click', (e) => {
            playClick();
            e.preventDefault();
            gameSocket.sellShares(stockSelect.value, parseInt(amountInput.value));
        });
    }

    if (btnRoll) {
        btnRoll.addEventListener('click', () => {
            const isMyTurn = (window.currentTurn == window.currentPlayerSlot);
            const isDicePhase = (window.currentPhase === 'dice');
            if (!isMyTurn || !isDicePhase) return;

            playClick();
            gameSocket.rollDice();
            btnRoll.disabled = true;
            btnRoll.textContent = '🎲 Rolling...';
        });
    }

    document.querySelectorAll('.qty-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            playClick();
            if (amountInput) {
                amountInput.value = btn.getAttribute('data-amount');
                updateCostDisplay();
            }
        });
    });
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
            const overlay = document.getElementById('dice-overlay');
            if (overlay) {
                overlay.style.display = 'none';
            }

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