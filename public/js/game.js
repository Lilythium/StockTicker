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
    try {
        const response = await fetch(`check_state.php?game_id=${encodeURIComponent(window.gameId)}`);
        const data = await response.json();

        if (!data.success) return;

        if (data.data && data.data.game_over) {
            window.location.href = `game_over.php?game_id=${encodeURIComponent(window.gameId)}`;
            return;
        }

        if (data.data && data.data.dice_results) {
            const currentDiceResults = JSON.stringify(data.data.dice_results);

            if (currentDiceResults !== lastDiceResults && !isFirstPoll) {
                lastDiceResults = currentDiceResults;
                const [stock, action, amount] = data.data.dice_results;
                const newStocks = data.data.stocks;

                if (!animationInProgress) {
                    showRollAnimation(stock, action, amount, () => {
                        if (action !== 'div' && newStocks[stock]) {
                            updateStockDisplay(stock, newStocks[stock]);
                        }
                        setTimeout(() => location.reload(), 1200);
                    });
                }
                return;
            }

            if (isFirstPoll) lastDiceResults = currentDiceResults;
        }

        if (data.phase !== lastPhase && !autoRefreshScheduled) {
            autoRefreshScheduled = true;
            setTimeout(() => location.reload(), 1500);
            return;
        }

        if (data.phase === 'dice' && data.turn !== lastTurn && !autoRefreshScheduled) {
            lastTurn = data.turn;
            if (!isFirstPoll) setTimeout(() => location.reload(), 1000);
            return;
        }

        updateHistory();
        isFirstPoll = false;
    } catch (error) {
        console.error('Error checking game state:', error);
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

    if (!stockSelect || !amountInput || !costDisplay) return;

    function updateCost() {
        const stock = stockSelect.value;
        const amount = parseInt(amountInput.value) || 0;
        const price = stockPrices[stock] || 1.00;
        const cost = amount / 100 * price;
        costDisplay.value = `COST: $${cost.toFixed(2)}`;
    }

    if (tradeForm) {
        tradeForm.addEventListener('submit', function(e) {
            const action = e.submitter.value;
            const stock = stockSelect.value;
            const amount = parseInt(amountInput.value) || 0;
            const price = stockPrices[stock] || 1.00;
            const cost = amount / 100 * price;
            const playerCash = window.currentPlayerCash || 0;
            const playerShares = window.currentPlayerShares || {};

            if (action === 'buy_shares') {
                if (cost > playerCash) {
                    e.preventDefault();
                    showError(`Not enough cash! You need $${cost.toFixed(2)} but only have $${playerCash.toFixed(2)}`);
                    return false;
                }
            } else if (action === 'sell_shares') {
                const currentShares = playerShares[stock] || 0;
                if (amount > currentShares) {
                    e.preventDefault();
                    showError(`Not enough shares! You're trying to sell ${amount} ${stock} but only have ${currentShares}`);
                    return false;
                }
            }
        });
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
    const overlay = document.getElementById('dice-overlay');
    const dice = document.querySelectorAll('.die');
    const text = document.getElementById('dice-text');

    if (!overlay || !text || animationInProgress) {
        if (callback) callback();
        return;
    }

    animationInProgress = true;
    overlay.style.display = 'flex';
    dice.forEach(d => {
        d.classList.add('rolling');
        d.innerText = '?';
    });
    text.innerText = 'Rolling...';
    text.style.color = '#ecf0f1';

    setTimeout(() => {
        dice.forEach(d => d.classList.remove('rolling'));
        let displayStock = stock === "Industrials" ? "Indust." : stock;

        document.getElementById('die-stock').innerText = displayStock;
        document.getElementById('die-action').innerText = action.toUpperCase();
        document.getElementById('die-amount').innerText = amount + '¢';

        if (action === 'div') {
            text.innerText = `${stock} paid ${(amount / 100).toFixed(2)} dividend!`;
            text.style.color = '#f39c12';
        } else {
            text.innerText = `${stock} went ${action.toUpperCase()} ${amount}¢!`;
            text.style.color = action === 'up' ? '#27ae60' : '#e74c3c';
        }

        setTimeout(() => {
            overlay.style.display = 'none';
            animationInProgress = false;
            if (callback) callback();
        }, 2000);
    }, 1000);
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
    errorDiv.style.cssText = `background:#f8d7da;color:#721c24;padding:12px;border-radius:5px;margin:15px 0;border:3px solid #f5c6cb;font-weight:bold;animation:shake 0.5s;`;

    const actionForm = document.querySelector('.action-form');
    if (actionForm) actionForm.insertBefore(errorDiv, actionForm.firstChild);

    setTimeout(() => {
        errorDiv.style.transition = 'opacity 0.5s';
        errorDiv.style.opacity = '0';
        setTimeout(() => errorDiv.remove(), 500);
    }, 5000);
}