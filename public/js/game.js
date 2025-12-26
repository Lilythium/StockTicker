/* ===== STATE & CONSTANTS ===== */
let stockPrices = {};
let lastHistoryLength = 0;
let lastDiceResults = null;
let animationInProgress = false;
let lastPhase = window.currentPhase;
let lastTurn = window.currentTurn;
let autoRefreshScheduled = false;
let isFirstPoll = true;
window.isUserScrolled = false;
let weAreRolling = false;

/* ===== INITIALIZATION ===== */
document.addEventListener('DOMContentLoaded', function() {
    initializeStockPrices();
    initializeTradingForm();
    initializeTimer();
    initializeHistoryScroll();
    loadHistory().then(r => {});
    startPolling();

    if (window.initialDiceResults) {
        lastDiceResults = JSON.stringify(window.initialDiceResults);
    }
});

function initializeStockPrices() {
    const priceMarkers = document.querySelectorAll('.price-marker');
    priceMarkers.forEach(marker => {
        const cell = marker.closest('.price-cell');
        const stock = cell.getAttribute('data-stock');
        const priceText = marker.textContent.replace('$', '');
        stockPrices[stock] = parseFloat(priceText);
    });
}

/* ===== POLLING & STATE MANAGEMENT ===== */
function startPolling() {
    setInterval(checkGameState, 1500);
}

async function checkGameState() {
    // If we are rolling or animating, DO NOT TOUCH ANYTHING
    if (animationInProgress && !document.getElementById('die-stock').classList.contains('rolling')) return;

    try {
        // Cache buster &t= is vital for Incognito
        const response = await fetch(`check_state.php?game_id=${encodeURIComponent(window.gameId)}&t=${Date.now()}`);
        const data = await response.json();

        if (!data.success) return;

        // 1. Detect New Dice Roll
        if (data.data && data.data.dice_results) {
            const currentDiceResults = JSON.stringify(data.data.dice_results);

            if (currentDiceResults !== lastDiceResults && !isFirstPoll) {
                lastDiceResults = currentDiceResults; // Update immediately
                const [stock, action, amount] = data.data.dice_results;

                showRollAnimation(stock, action, amount, () => {
                    resetDoneCheckbox();
                    // Delay reload to let Incognito sessions sync
                    setTimeout(() => location.reload(), 1000);
                });
                return;
            }
            if (isFirstPoll) lastDiceResults = currentDiceResults;
        }

        // 2. Detect Phase Change
        if (data.phase !== lastPhase && !autoRefreshScheduled) {
            autoRefreshScheduled = true;
            resetDoneCheckbox();
            setTimeout(() => location.reload(), 1200);
            return;
        }

        updateHistory();
        isFirstPoll = false;
    } catch (error) {
        console.error('Polling error:', error);
    }
}

function resetDoneCheckbox() {
    const checkbox = document.getElementById('doneTradingCheckbox');
    const box = document.querySelector('.checkbox-box');

    if (checkbox) {
        checkbox.checked = false;
        checkbox.disabled = false;
    }

    if (box) {
        box.classList.remove('checked');
    }

    // If you have "Done Trading" text appearing only when checked,
    // this ensures the UI looks fresh for the new round.
    const text = document.querySelector('.checkbox-text');
    if (text && text.innerText === "Done Trading") {
        text.style.opacity = '0.5'; // Or hide it
    }
}

/* ===== AJAX GAME ACTIONS ===== */
async function performGameAction(action, params = {}) {
    if (action === 'roll_dice') weAreRolling = true; // Block poller immediately

    try {
        const formData = new FormData();
        formData.append('action', action);
        for (const [key, value] of Object.entries(params)) {
            formData.append(key, value);
        }

        const response = await fetch('api/game_action.php', { method: 'POST', body: formData });
        const data = await response.json();

        if (!data.success) {
            weAreRolling = false; // Release lock if it failed
            throw new Error(data.error);
        }

        if (action === 'roll_dice') {
            const roll = data.data;

            if (action === 'roll_dice') {
                const roll = data.data;

                if (roll && roll.stock) {
                    showRollAnimation(roll.stock, roll.action, roll.amount, () => {
                        resetDoneCheckbox();
                        weAreRolling = false;
                        location.reload();
                    });
                } else {
                    // If the server didn't send data, release the lock
                    // so the background poller can finish the job
                    weAreRolling = false;
                    console.log("Waiting for background update...");

                    // Safety timeout to prevent infinite shaking
                    setTimeout(() => {
                        if (animationInProgress) location.reload();
                    }, 4000);
                }
                return true;
            }
            return true;
        }

        location.reload();
    } catch (error) {
        weAreRolling = false;
        console.error("ACTION ERROR:", error);
        showError(error.message);
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


    if (rollButton) {
        // We remove the .cloneNode part to keep it simple.
        // Just ensure we only attach the listener ONCE.
        rollButton.onclick = function(e) {
            e.preventDefault();
            if (this.disabled || weAreRolling || animationInProgress) return;

            // 1. Lock the UI immediately
            weAreRolling = true;
            this.disabled = true;
            this.innerHTML = '🎲 Rolling...';

            // 2. START THE SHAKING PART IMMEDIATELY (Visual feedback)
            // We call showRollAnimation with nulls to trigger the 'shaking' state
            startInstantShaking();

            // 3. Fire the actual server request
            performGameAction('roll_dice');
        };
    }

    if (!stockSelect || !amountInput || !costDisplay) return;

    function updateCost() {
        const stock = stockSelect.value;
        const amount = parseInt(amountInput.value) || 0;
        const price = stockPrices[stock] || 1.00;
        const cost = amount / 100 * price;
        costDisplay.value = `COST: $${cost.toFixed(2)}`;
    }

    // Handle trade form submission
    if (tradeForm) {
        tradeForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const action = e.submitter.value;
            const stock = stockSelect.value;
            const amount = parseInt(amountInput.value) || 0;
            const price = stockPrices[stock] || 1.00;
            const cost = amount / 100 * price;
            const playerCash = window.currentPlayerCash || 0;
            const playerShares = window.currentPlayerShares || {};

            // Validate
            if (action === 'buy_shares') {
                if (cost > playerCash) {
                    showError(`Not enough cash! You need $${cost.toFixed(2)} but only have $${playerCash.toFixed(2)}`);
                    return;
                }
            } else if (action === 'sell_shares') {
                const currentShares = playerShares[stock] || 0;
                if (amount > currentShares) {
                    showError(`Not enough shares! You're trying to sell ${amount} ${stock} but only have ${currentShares}`);
                    return;
                }
            }

            // Perform action via AJAX
            await performGameAction(action, {
                stock: stock,
                amount: amount
            });
        });
    }

    // Handle done trading checkbox
    if (doneCheckbox) {
        doneCheckbox.addEventListener('click', async function(e) {
            // We use 'click' instead of 'change' to capture it immediately

            // Prevent the box from visually toggling until server confirms
            e.preventDefault();

            if (this.disabled) return;

            // Optional: Visually indicate loading
            const label = this.parentElement.querySelector('.checkbox-text') || this.parentElement;
            const originalText = label.innerText;
            // label.innerText = "Saving...";

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
    updateCost();
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
function updateStockDisplay(stock, newPrice) {
    const currentMarker = document.querySelector('.price-cell.current-price .price-marker');
    const currentCell = currentMarker ? currentMarker.closest('.price-cell') : null;
    const currentStock = currentCell ? currentCell.getAttribute('data-stock') : null;

    if (currentStock !== stock) {
        const allCells = document.querySelectorAll(`.price-cell[data-stock="${stock}"]`);
        allCells.forEach(cell => {
            if (cell.classList.contains('current-price')) {
                cell.classList.remove('current-price');
                cell.innerHTML = '';
            }
        });
    }

    stockPrices[stock] = newPrice;
    const priceCents = Math.round(newPrice * 100);
    const targetCell = document.querySelector(`.price-cell[data-stock="${stock}"][data-price="${priceCents}"]`);

    if (targetCell) {
        const stockRow = targetCell.closest('tr');
        const oldMarker = stockRow.querySelector('.current-price');
        if (oldMarker) {
            oldMarker.classList.remove('current-price');
            oldMarker.innerHTML = '';
        }

        targetCell.classList.add('current-price');
        targetCell.innerHTML = `<div class="price-marker price-marker-animate">$${newPrice.toFixed(2)}</div>`;

        setTimeout(() => {
            const marker = targetCell.querySelector('.price-marker');
            if (marker) marker.classList.remove('price-marker-animate');
        }, 500);
    }
}

function showRollAnimation(stock, action, amount, callback) {
    // If the overlay is already shaking (from startInstantShaking), we just reveal.
    if (animationInProgress && document.getElementById('die-stock').classList.contains('rolling')) {
        revealWhenReady(stock, action, amount, callback);
    } else {
        // This handles when OTHER players roll (Poller triggers this)
        startInstantShaking();
        setTimeout(() => {
            revealWhenReady(stock, action, amount, callback);
        }, 500);
    }
}

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
            text.innerText = `${stock} ${action.toUpperCase()} ${amount}¢!`;
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
    if (!el) return;
    el.classList.remove('rolling');
    el.classList.add('die-reveal');
    el.innerText = val;
}