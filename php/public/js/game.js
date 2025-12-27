/* ===== STATE & CONSTANTS ===== */
let stockPrices = {};
let lastHistoryLength = 0;
let animationInProgress = false;
window.isUserScrolled = false;

// Audio paths (same as before)
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

let isShaking = false;

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

/* ===== INITIALIZATION ===== */
document.addEventListener('DOMContentLoaded', function() {
    initializeStockPrices();
    initializeTradingForm();
    initializeTimer();
    initializeHistoryScroll();

    // Add click sounds
    document.addEventListener('click', (e) => {
        const target = e.target.closest('button, .qty-btn, .spin-btn, input[type="submit"], input[type="button"], .btn-roll-ready, .checkbox-label, .checkbox-box');
        if (target) {
            playSound(AUDIO_PATHS.ui.click);
        }
    });

    const stockSelect = document.getElementById('stockSelect');
    if (stockSelect) {
        stockSelect.addEventListener('mousedown', () => playSound(AUDIO_PATHS.ui.click));
        stockSelect.addEventListener('change', () => playSound(AUDIO_PATHS.ui.click));
    }
});

function initializeStockPrices() {
    const priceMarkers = document.querySelectorAll('.price-marker');
    priceMarkers.forEach(marker => {
        const cell = marker.closest('.price-cell');
        const stock = cell.getAttribute('data-stock');
        const priceInCents = parseFloat(marker.textContent);
        stockPrices[stock] = priceInCents / 100;
    });
}

/* ===== SOCKET.IO EVENT HANDLERS ===== */
function handleGameStateUpdate(state) {
    console.log('Handling game state update:', state);

    // Update stock prices
    if (state.stocks) {
        updateStockPrices(state.stocks);
    }

    // Update player cards
    if (state.players) {
        updateAllPlayerCards(state.players);
    }

    // Update phase indicator
    if (state.current_phase) {
        updatePhaseIndicator(state.current_phase, state.current_turn);
    }

    // Update timer
    if (state.time_remaining !== undefined) {
        updateTimer(state.time_remaining);
    }

    // Update done trading count
    if (state.done_trading_count !== undefined && state.active_player_count !== undefined) {
        updateDoneCount(state.done_trading_count, state.active_player_count);
    }

    // Update history
    if (state.history && state.history.length !== lastHistoryLength) {
        renderHistory(state.history);
        lastHistoryLength = state.history.length;
    }

    // Check for game over
    if (state.game_over) {
        playSound(AUDIO_PATHS.ui.gameOver);
        setTimeout(() => {
            window.location.href = `game_over.php?game_id=${window.gameId}`;
        }, 1000);
    }
}

function handleDiceRolled(data) {
    console.log('Dice rolled event:', data);

    // Queue the animation
    queueDiceRoll(data.stock, data.action, data.amount);
}

function handlePhaseChanged(data) {
    console.log('Phase changed:', data);
    playSound(AUDIO_PATHS.ui.phaseChange);

    // Reload page to update UI
    setTimeout(() => {
        window.location.reload();
    }, 800);
}

/* ===== UI UPDATE FUNCTIONS ===== */
function updateStockPrices(stocks) {
    for (const [stock, price] of Object.entries(stocks)) {
        stockPrices[stock] = price;

        // Update visual marker position
        const stockName = stock === 'Industrials' ? 'Indust.' : stock;
        const row = document.querySelector(`.${stock.toLowerCase()}-row`);
        if (!row) continue;

        // Clear old markers
        row.querySelectorAll('.price-cell').forEach(cell => {
            cell.classList.remove('current-price');
            const marker = cell.querySelector('.price-marker');
            if (marker) marker.remove();
        });

        // Add new marker
        const priceInCents = Math.round(price * 100);
        const targetCell = row.querySelector(`[data-price="${priceInCents}"]`);
        if (targetCell) {
            targetCell.classList.add('current-price');
            targetCell.innerHTML = `<div class="price-marker">${priceInCents}</div>`;
        }
    }
}

function updateAllPlayerCards(players) {
    for (const [slot, player] of Object.entries(players)) {
        if (!player.is_active) continue;

        const card = findPlayerCard(player.name);
        if (!card) continue;

        // Update cash
        const cashEl = card.querySelector('.player-cash');
        if (cashEl) {
            cashEl.textContent = formatMoney(player.cash);
        }

        // Update portfolio
        const portfolioTable = card.querySelector('.portfolio-table tbody');
        if (portfolioTable && player.portfolio) {
            let html = '';
            let totalShrs = 0;
            let totalVal = 0;

            for (const [stock, qty] of Object.entries(player.portfolio)) {
                const stockPrice = stockPrices[stock] || 1.0;
                const value = qty * stockPrice;

                totalShrs += qty;
                totalVal += value;

                html += `
                    <tr>
                        <td class="stock-name">${stock}</td>
                        <td class="stock-qty">${qty.toLocaleString()} <small>SHRS</small></td>
                        <td class="stock-val">${formatMoney(value)}</td>
                    </tr>
                `;
            }

            html += `
                <tr class="portfolio-totals">
                    <td class="stock-name"><strong>Totals</strong></td>
                    <td class="stock-qty">${totalShrs.toLocaleString()} <small>SHRS</small></td>
                    <td class="stock-val">${formatMoney(totalVal)}</td>
                </tr>
            `;

            portfolioTable.innerHTML = html;
        }

        // Update done trading badge
        const doneCheck = card.querySelector('.done-check');
        if (player.done_trading && window.currentPhase === 'trading') {
            if (!doneCheck) {
                const identity = card.querySelector('.player-identity');
                if (identity) {
                    identity.insertAdjacentHTML('beforeend', '<span class="done-check">✅</span>');
                }
            }
        } else if (doneCheck) {
            doneCheck.remove();
        }
    }
}

function findPlayerCard(playerName) {
    const cards = document.querySelectorAll('.player-card');
    for (const card of cards) {
        const nameEl = card.querySelector('.player-name');
        if (nameEl && nameEl.textContent.trim() === playerName) {
            return card;
        }
    }
    return null;
}

function updatePhaseIndicator(phase, turn) {
    const phaseLabel = document.querySelector('.phase-label');
    if (phaseLabel) {
        phaseLabel.textContent = phase === 'trading' ? '🔄 TRADING' : '🎲 DICE';
        phaseLabel.className = `phase-label ${phase}`;
    }
}

function updateTimer(remaining) {
    const timerEl = document.getElementById('timer');
    if (timerEl) {
        const mins = Math.floor(remaining / 60);
        const secs = Math.floor(remaining % 60);
        timerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
}

function updateDoneCount(doneCount, totalPlayers) {
    const statusEl = document.querySelector('.players-status');
    if (statusEl && window.currentPhase === 'trading') {
        statusEl.textContent = `${doneCount}/${totalPlayers} Ready`;
    }
}

/* ===== GAME ACTIONS (using Socket.IO) ===== */
function initializeTradingForm() {
    const tradeForm = document.getElementById('tradeForm');
    const rollButton = document.querySelector('.btn-roll-ready');
    const doneCheckbox = document.getElementById('doneTradingCheckbox');

    // Trade form submission
    if (tradeForm) {
        tradeForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const action = e.submitter.value;
            const stockSelect = document.getElementById('stockSelect');
            const amountInput = document.querySelector('.amount-input');

            const stock = stockSelect.value;
            const amount = parseInt(amountInput.value) || 0;

            // Validation
            const price = stockPrices[stock] || 1.00;
            const cost = amount * price;

            if (action === 'buy_shares') {
                const playerCash = window.currentPlayerCash || 0;
                if (cost > playerCash) {
                    showError(`Not enough cash! You need ${formatMoney(cost)} but only have ${formatMoney(playerCash)}`);
                    return;
                }
                gameSocket.buyShares(stock, amount);
            } else if (action === 'sell_shares') {
                const playerShares = window.currentPlayerShares || {};
                const currentShares = playerShares[stock] || 0;
                if (amount > currentShares) {
                    showError(`Not enough shares! You're trying to sell ${amount} ${stock} but only have ${currentShares}`);
                    return;
                }
                gameSocket.sellShares(stock, amount);
            }

            saveTradeFormState();
        });
    }

    // Roll button
    if (rollButton) {
        rollButton.onclick = function(e) {
            e.preventDefault();
            if (this.disabled || animationInProgress) return;

            this.disabled = true;
            this.innerHTML = '🎲 Rolling...';

            startInstantShaking();
            gameSocket.rollDice();
        };
    }

    // Done trading checkbox
    if (doneCheckbox) {
        doneCheckbox.addEventListener('change', function() {
            playSound(AUDIO_PATHS.ui.click);

            if (this.disabled) return;

            this.disabled = true;
            const wrapper = this.closest('.done-trading-control');
            if (wrapper) {
                wrapper.classList.add('checked');
            }

            gameSocket.markDoneTrading();
        });
    }

    // Setup stock select, amount controls, etc. (same as before)
    setupTradeControls();
}

function setupTradeControls() {
    const stockSelect = document.getElementById('stockSelect');
    const amountInput = document.querySelector('.amount-input');
    const costDisplay = document.getElementById('costDisplay');
    const spinUp = document.querySelector('.spin-up');
    const spinDown = document.querySelector('.spin-down');
    const qtyButtons = document.querySelectorAll('.qty-btn');

    function updateCost() {
        const stock = stockSelect.value;
        const amount = parseInt(amountInput.value) || 0;
        const price = stockPrices[stock] || 1.00;
        const cost = amount * price;
        costDisplay.value = `COST: ${formatMoney(cost)}`;
        highlightActiveButton();
        saveTradeFormState();
    }

    function highlightActiveButton() {
        const currentVal = parseInt(amountInput.value) || 0;
        qtyButtons.forEach(btn => {
            const btnVal = parseInt(btn.getAttribute('data-amount'));
            btn.classList.toggle('active', currentVal === btnVal);
        });
    }

    function updateSelectColor() {
        const classes = ['select-gold', 'select-silver', 'select-oil', 'select-bonds', 'select-industrials', 'select-grain'];
        stockSelect.classList.remove(...classes);
        const selectedValue = stockSelect.value.toLowerCase();
        stockSelect.classList.add(`select-${selectedValue}`);
    }

    if (stockSelect) {
        stockSelect.addEventListener('change', () => {
            updateCost();
            updateSelectColor();
        });
        updateSelectColor();
    }

    if (spinUp) {
        spinUp.addEventListener('click', () => {
            amountInput.value = (parseInt(amountInput.value) || 0) + 500;
            updateCost();
        });
    }

    if (spinDown) {
        spinDown.addEventListener('click', () => {
            let val = parseInt(amountInput.value) || 0;
            if (val > 500) {
                amountInput.value = val - 500;
                updateCost();
            }
        });
    }

    qtyButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            amountInput.value = this.getAttribute('data-amount');
            updateCost();
        });
    });

    restoreTradeFormState();
    if (!localStorage.getItem('lastTradeStock')) {
        updateCost();
    }
}

/* ===== TRADE FORM STATE (localStorage) ===== */
let isRestoring = false;

function saveTradeFormState() {
    if (isRestoring) return;

    const stockSelect = document.getElementById('stockSelect');
    const amountInput = document.querySelector('.amount-input');

    if (stockSelect && amountInput) {
        localStorage.setItem('lastTradeStock', stockSelect.value);
        localStorage.setItem('lastTradeAmount', amountInput.value);
    }
}

function restoreTradeFormState() {
    isRestoring = true;

    const stockSelect = document.getElementById('stockSelect');
    const amountInput = document.querySelector('.amount-input');

    const savedStock = localStorage.getItem('lastTradeStock');
    const savedAmount = localStorage.getItem('lastTradeAmount');

    if (savedStock && stockSelect) {
        stockSelect.value = savedStock;
    }

    if (savedAmount && amountInput) {
        amountInput.value = savedAmount;
    }

    if (stockSelect) {
        stockSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }

    isRestoring = false;
}

/* ===== DICE ANIMATION (same as before) ===== */
let diceRollQueue = [];
let isProcessingRoll = false;

function queueDiceRoll(stock, action, amount) {
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
    playShakeSounds();

    animationInProgress = true;
    overlay.style.display = 'flex';

    dice.forEach(d => {
        if (d) {
            d.classList.add('rolling');
            d.innerText = '?';
        }
    });
}

function playShakeSounds() {
    if (!isShaking) return;

    const snd = playSound('shakes');
    snd.volume = Math.random() * (1.0 - 0.7) + 0.7;

    const nextGap = Math.random() * 50 + 40;
    setTimeout(playShakeSounds, nextGap);
}

function showRollAnimation(stock, action, amount, callback) {
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

    setTimeout(() => {
        revealDie(dice.amount, amount + '¢');

        if (text) {
            text.classList.add('reveal-text');
            if (action.toUpperCase() === "DIV") {
                if (stockPrices[stock] > 1.00) {
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
            isShaking = false;

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
        const type = entry.type || 'unknown';
        const timestamp = new Date(entry.timestamp * 1000).toLocaleTimeString();
        html += `<div class="history-entry event-${type}">[${timestamp}] ${entry.message}</div>`;
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