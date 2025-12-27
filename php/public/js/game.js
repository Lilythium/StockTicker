/* ===== STATE & CONSTANTS ===== */
let stockPrices = {};
let lastHistoryLength = 0;
let lastDiceResults = null;
let animationInProgress = false;
let lastPhase = window.currentPhase;
let lastTurn = window.currentTurn;
let isFirstPoll = true;
window.isUserScrolled = false;
let rollLockTimeout = null;
let lastPlayerStates = {};
let lastDoneCount = 0;

// Dice roll queue to prevent skipped rolls
let diceRollQueue = [];
let isProcessingRoll = false;

/* ===== HELPER FUNCTIONS ===== */
function formatMoney(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

/* ===== INITIALIZATION ===== */
document.addEventListener('DOMContentLoaded', function() {
    initializeStockPrices();
    initializeTradingForm(); // This now handles restoration internally
    initializeTimer();
    initializeHistoryScroll();
    loadHistory().then(r => {});
    startPolling();

    if (window.initialDiceResults) {
        lastDiceResults = JSON.stringify(window.initialDiceResults);
    }

    // Initialize last player states
    updateLastPlayerStates();
});

function initializeStockPrices() {
    const priceMarkers = document.querySelectorAll('.price-marker');
    priceMarkers.forEach(marker => {
        const cell = marker.closest('.price-cell');
        const stock = cell.getAttribute('data-stock');
        const priceInCents = parseFloat(marker.textContent);
        // Convert cents to dollars
        stockPrices[stock] = priceInCents / 100;
    });
}

/* ===== TRADE FORM STATE PERSISTENCE ===== */
let isRestoring = false; // Flag to prevent saving during restoration

function saveTradeFormState() {
    // Don't save while we're restoring
    if (isRestoring) return;

    const stockSelect = document.getElementById('stockSelect');
    const amountInput = document.querySelector('.amount-input');

    if (stockSelect && amountInput) {
        localStorage.setItem('lastTradeStock', stockSelect.value);
        localStorage.setItem('lastTradeAmount', amountInput.value);
    }
}

function restoreTradeFormState() {
    isRestoring = true; // Set flag to prevent saving during restoration

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

    // Trigger change event to update everything (cost, color, highlights)
    if (stockSelect) {
        const event = new Event('change', { bubbles: true });
        stockSelect.dispatchEvent(event);
    }

    isRestoring = false; // Clear flag after restoration
}

/* ===== POLLING & STATE MANAGEMENT ===== */
function startPolling() {
    setInterval(checkGameState, 1500);
}

async function checkGameState() {
    // Don't poll during dice animation
    if (animationInProgress) return;

    try {
        const response = await fetch(`check_state.php?game_id=${encodeURIComponent(window.gameId)}&t=${Date.now()}`);
        const data = await response.json();

        if (!data.success) return;

        // 1. Check for game over
        if (data.data && data.data.game_over) {
            location.href = `game_over.php?game_id=${encodeURIComponent(window.gameId)}`;
            return;
        }

        // 2. Detect New Dice Roll and queue it
        if (data.data && data.data.dice_results) {
            const diceData = data.data.dice_results;
            const currentRollId = diceData.roll_id;

            console.log('Poll detected dice_results:', diceData);
            console.log('Last roll_id:', lastDiceResults ? JSON.parse(lastDiceResults).roll_id : 'none');
            console.log('Current roll_id:', currentRollId);
            console.log('Is first poll?', isFirstPoll);

            // Compare by roll_id to ensure we catch every unique roll
            const lastRollId = lastDiceResults ? JSON.parse(lastDiceResults).roll_id : null;

            if (currentRollId !== lastRollId && !isFirstPoll) {
                lastDiceResults = JSON.stringify(diceData);
                const stock = diceData.stock;
                const action = diceData.action;
                const amount = diceData.amount;

                console.log('🎲 NEW ROLL DETECTED! (roll_id changed)', currentRollId, '- Queueing animation:', stock, action, amount);

                // Add to queue instead of processing immediately
                queueDiceRoll(stock, action, amount);
                return;
            }
            if (isFirstPoll) {
                console.log('First poll - setting lastDiceResults without animating');
                lastDiceResults = JSON.stringify(diceData);
            }
        } else if (data.data && !data.data.dice_results) {
            // Dice results cleared (between turns)
            console.log('Dice results cleared - ready for next roll');
            lastDiceResults = null;
        }

        // 3. Detect Phase Change
        if (data.phase !== lastPhase) {
            lastPhase = data.phase;
            setTimeout(() => location.reload(), 800);
            return;
        }

        // 4. Update UI elements without reload
        await updatePlayerCards();
        updateDoneCount(data.done_count || 0);
        updateFormState();
        updateHistory();

        isFirstPoll = false;
    } catch (error) {
        console.error('Polling error:', error);
    }
}

/* ===== DICE ROLL QUEUE SYSTEM ===== */
function queueDiceRoll(stock, action, amount) {
    diceRollQueue.push({ stock, action, amount });
    processNextRoll();
}

function processNextRoll() {
    // If already processing or queue is empty, do nothing
    if (isProcessingRoll || diceRollQueue.length === 0) return;

    isProcessingRoll = true;
    const roll = diceRollQueue.shift();

    showRollAnimation(roll.stock, roll.action, roll.amount, () => {
        isProcessingRoll = false;

        // Check if there are more rolls in the queue
        if (diceRollQueue.length > 0) {
            // Process next roll immediately
            setTimeout(() => processNextRoll(), 500);
        } else {
            // Queue is empty, reload page
            setTimeout(() => location.reload(), 1000);
        }
    });
}

/* ===== DYNAMIC UI UPDATES ===== */
async function updatePlayerCards() {
    try {
        const response = await fetch(`get_game_state.php?game_id=${encodeURIComponent(window.gameId)}&t=${Date.now()}`);
        const data = await response.json();

        if (!data.success || !data.data || !data.data.players) return;

        const players = data.data.players;

        // Update each player card
        Object.keys(players).forEach(slot => {
            const player = players[slot];
            if (!player.is_active) return;

            const playerCard = findPlayerCard(player.name);
            if (!playerCard) return;

            // Update cash with consistent formatting
            const cashEl = playerCard.querySelector('.player-cash');
            if (cashEl) {
                cashEl.textContent = formatMoney(player.cash);
            }

            // Update portfolio
            const portfolioTable = playerCard.querySelector('.portfolio-table tbody');
            if (portfolioTable && player.portfolio) {
                let html = '';
                let totalShrs = 0;
                let totalVal = 0;
                for (const [stock, qty] of Object.entries(player.portfolio)) {
                    const stockPrice = data.data.stocks[stock] || 1.0;
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
            const doneCheck = playerCard.querySelector('.done-check');
            if (player.done_trading && window.currentPhase === 'trading') {
                if (!doneCheck) {
                    const identity = playerCard.querySelector('.player-identity');
                    if (identity) {
                        identity.insertAdjacentHTML('beforeend', '<span class="done-check">✅</span>');
                    }
                }
            } else if (doneCheck) {
                doneCheck.remove();
            }
        });
    } catch (error) {
        console.error('Error updating player cards:', error);
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

function updateDoneCount(count) {
    if (count === lastDoneCount) return;
    lastDoneCount = count;

    const statusEl = document.querySelector('.players-status');
    if (statusEl && window.currentPhase === 'trading') {
        const totalPlayers = document.querySelectorAll('.player-card').length;
        statusEl.textContent = `${count}/${totalPlayers} Ready`;
    }
}

function updateFormState() {
    const actionForm = document.querySelector('.action-form');
    const checkbox = document.getElementById('doneTradingCheckbox');

    if (!actionForm || !checkbox) return;

    // Check if player is done trading
    const isDone = checkbox.checked;
    const isDicePhase = window.currentPhase === 'dice';

    // Disable/enable form elements
    const tradeInputs = actionForm.querySelectorAll('.stock-select, .amount-input, .qty-btn, .spin-btn, .btn-buy, .btn-sell');
    tradeInputs.forEach(input => {
        input.disabled = isDone || isDicePhase;
    });

    // Toggle form-disabled class
    if (isDone || isDicePhase) {
        actionForm.classList.add('form-disabled');
    } else {
        actionForm.classList.remove('form-disabled');
    }
}

function updateLastPlayerStates() {
    const cards = document.querySelectorAll('.player-card');
    cards.forEach(card => {
        const nameEl = card.querySelector('.player-name');
        const cashEl = card.querySelector('.player-cash');
        if (nameEl && cashEl) {
            const name = nameEl.textContent.trim();
            const cash = cashEl.textContent;
            lastPlayerStates[name] = { cash };
        }
    });
}

/* ===== AJAX GAME ACTIONS ===== */
async function performGameAction(action, params = {}) {
    // Clear any existing lock timeout
    if (rollLockTimeout) {
        clearTimeout(rollLockTimeout);
        rollLockTimeout = null;
    }

    try {
        const formData = new FormData();
        formData.append('action', action);
        for (const [key, value] of Object.entries(params)) {
            formData.append(key, value);
        }

        const response = await fetch('api/game_action.php', { method: 'POST', body: formData });
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Action failed');
        }

        if (action === 'roll_dice') {
            const roll = data.data;

            if (roll && roll.stock) {
                // Server returned dice data immediately - queue it
                queueDiceRoll(roll.stock, roll.action, roll.amount);
            } else {
                // Wait for poller to catch the roll
                console.log('Waiting for dice results from server...');

                // Safety timeout - reload if animation doesn't start
                rollLockTimeout = setTimeout(() => {
                    if (!animationInProgress && diceRollQueue.length === 0) {
                        console.log('Roll timeout - reloading');
                        location.reload();
                    }
                }, 3000);
            }
            return true;
        }

        // For other actions, just reload
        location.reload();
    } catch (error) {
        console.error("ACTION ERROR:", error);
        showError(error.message);

        // Reset button state on error
        const rollBtn = document.querySelector('.btn-roll-ready');
        if (rollBtn && action === 'roll_dice') {
            rollBtn.disabled = false;
            rollBtn.innerHTML = window.isYourTurn ? '🎲 ROLL!' : '⏳ Waiting...';
        }
    }
}

/* ===== TRADING & FORMS ===== */
function initializeTradingForm() {
    const stockSelect = document.getElementById('stockSelect');
    const amountInput = document.querySelector('.amount-input');
    const costDisplay = document.getElementById('costDisplay');
    const spinUp = document.querySelector('.spin-up');
    const spinDown = document.querySelector('.spin-down');
    const qtyButtons = document.querySelectorAll('.qty-btn');
    const tradeForm = document.getElementById('tradeForm');
    const rollButton = document.querySelector('.btn-roll-ready');
    const doneCheckbox = document.getElementById('doneTradingCheckbox');

    function highlightActiveButton() {
        const currentVal = parseInt(amountInput.value) || 0;

        qtyButtons.forEach(btn => {
            const btnVal = parseInt(btn.getAttribute('data-amount'));
            if (currentVal === btnVal) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    function updateSelectColor() {
        const stockSelect = document.getElementById('stockSelect');
        if (!stockSelect) return;

        // Remove all previous color classes
        const classes = ['select-gold', 'select-silver', 'select-oil', 'select-bonds', 'select-industrials', 'select-grain'];
        stockSelect.classList.remove(...classes);

        // Add the class matching the current value (lowercase matches our CSS classes)
        const selectedValue = stockSelect.value.toLowerCase();
        stockSelect.classList.add(`select-${selectedValue}`);
    }

    // Add the event listener inside initializeTradingForm where other listeners are
    if (stockSelect) {
        stockSelect.addEventListener('change', updateSelectColor);
        // Run once immediately to set initial color
        updateSelectColor();
    }

    if (rollButton) {
        rollButton.onclick = function(e) {
            e.preventDefault();
            if (this.disabled || animationInProgress) return;

            // Lock the button
            this.disabled = true;
            this.innerHTML = '🎲 Rolling...';

            // Start shaking animation immediately
            startInstantShaking();

            // Fire server request
            performGameAction('roll_dice');
        };
    }

    if (!stockSelect || !amountInput || !costDisplay) return;

    function updateCost() {
        const stock = stockSelect.value;
        const amount = parseInt(amountInput.value) || 0;
        const price = stockPrices[stock] || 1.00;
        // Fixed: amount is already in shares, price is in dollars
        const cost = amount * price;
        costDisplay.value = `COST: ${formatMoney(cost)}`;
        highlightActiveButton();

        // Save state whenever values change
        saveTradeFormState();
    }

    // Handle trade form submission
    if (tradeForm) {
        tradeForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const action = e.submitter.value;
            const stock = stockSelect.value;
            const amount = parseInt(amountInput.value) || 0;
            const price = stockPrices[stock] || 1.00;
            const cost = amount * price;
            const playerCash = window.currentPlayerCash || 0;
            const playerShares = window.currentPlayerShares || {};

            // Validate
            if (action === 'buy_shares') {
                if (cost > playerCash) {
                    showError(`Not enough cash! You need ${formatMoney(cost)} but only have ${formatMoney(playerCash)}`);
                    return;
                }
            } else if (action === 'sell_shares') {
                const currentShares = playerShares[stock] || 0;
                if (amount > currentShares) {
                    showError(`Not enough shares! You're trying to sell ${amount} ${stock} but only have ${currentShares}`);
                    return;
                }
            }

            // Save form state before reload
            saveTradeFormState();

            // Submit the action
            await performGameAction(action, {
                stock: stock,
                amount: amount
            });
        });
    }

    // Handle done trading checkbox
    if (doneCheckbox) {
        doneCheckbox.addEventListener('click', async function(e) {
            e.preventDefault();
            if (this.disabled) return;

            // Disable immediately to prevent double-clicks
            this.disabled = true;

            await performGameAction('done_trading', {
                player: window.currentPlayerSlot
            });
        });
    }

    // Spinner buttons
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

    // Quick amount buttons
    qtyButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            amountInput.value = this.getAttribute('data-amount');
            updateCost();
        });
    });

    stockSelect.addEventListener('change', updateCost);

    // Restore saved form state FIRST, then call updateCost
    restoreTradeFormState();

    // If no saved state, run updateCost for the defaults
    if (!localStorage.getItem('lastTradeStock')) {
        updateCost();
    }
}

/* ===== HISTORY & LOGS ===== */
function initializeHistoryScroll() {
    const historyContent = document.getElementById('historyContent');
    if (!historyContent) return;

    historyContent.addEventListener('scroll', function() {
        const isNearBottom = this.scrollHeight - this.scrollTop - this.clientHeight < 10;
        window.isUserScrolled = !isNearBottom;
    });

    historyContent.addEventListener('click', function() {
        const isNearBottom = this.scrollHeight - this.scrollTop - this.clientHeight < 10;
        if (isNearBottom) window.isUserScrolled = false;
    });
}

async function loadHistory() {
    if (window.initialHistory && window.initialHistory.length > 0) {
        renderHistory(window.initialHistory);
        lastHistoryLength = window.initialHistory.length;
        return;
    }

    try {
        const response = await fetch(`get_game_state.php?game_id=${encodeURIComponent(window.gameId)}`);
        const data = await response.json();
        if (data.success && data.data && data.data.history) {
            renderHistory(data.data.history);
            lastHistoryLength = data.data.history.length;
        }
    } catch (error) {
        console.error('Error loading history:', error);
    }
}

async function updateHistory() {
    try {
        const response = await fetch(`get_game_state.php?game_id=${encodeURIComponent(window.gameId)}`);
        const data = await response.json();

        if (data.success && data.data && data.data.history) {
            if (data.data.history.length !== lastHistoryLength) {
                renderHistory(data.data.history);
                lastHistoryLength = data.data.history.length;
            }
        }
    } catch (error) {
        console.error('Error updating history:', error);
    }
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

/* ===== UI FEEDBACK & ANIMATIONS ===== */
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

function startInstantShaking() {
    const overlay = document.getElementById('dice-overlay');
    const dice = [
        document.getElementById('die-stock'),
        document.getElementById('die-action'),
        document.getElementById('die-amount')
    ];

    if (!overlay) return;

    animationInProgress = true;
    overlay.style.display = 'flex';

    dice.forEach(d => {
        if (d) {
            d.classList.add('rolling');
            d.innerText = '?';
        }
    });
}

function showRollAnimation(stock, action, amount, callback) {
    // If already shaking, just reveal
    if (animationInProgress && document.getElementById('die-stock').classList.contains('rolling')) {
        revealWhenReady(stock, action, amount, callback);
    } else {
        // Start from scratch
        startInstantShaking();
        setTimeout(() => {
            revealWhenReady(stock, action, amount, callback);
        }, 500);
    }
}

async function revealWhenReady(stock, action, amount, callback) {
    const dice = {
        stock: document.getElementById('die-stock'),
        action: document.getElementById('die-action'),
        amount: document.getElementById('die-amount')
    };
    const text = document.getElementById('dice-text');

    // Reveal Stock
    setTimeout(() => {
        revealDie(dice.stock, (stock === "Industrials" ? "Indust." : stock).toUpperCase());
    }, 200);

    // Reveal Action
    setTimeout(() => {
        revealDie(dice.action, action.toUpperCase());
    }, 500);

    // Reveal Amount
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

            // Clear any pending roll lock timeout
            if (rollLockTimeout) {
                clearTimeout(rollLockTimeout);
                rollLockTimeout = null;
            }

            if (callback) callback();
        }, 1500);
    }, 800);
}

function revealDie(el, val) {
    if (!el) return;
    el.classList.remove('rolling');
    el.classList.add('die-reveal');
    el.innerText = val;
}