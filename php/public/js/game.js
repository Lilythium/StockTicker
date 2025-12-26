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

    // Initialize last player states
    updateLastPlayerStates();
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

        // 2. Detect New Dice Roll
        if (data.data && data.data.dice_results) {
            const currentDiceResults = JSON.stringify(data.data.dice_results);

            if (currentDiceResults !== lastDiceResults && !isFirstPoll) {
                lastDiceResults = currentDiceResults;
                const [stock, action, amount] = data.data.dice_results;

                showRollAnimation(stock, action, amount, () => {
                    setTimeout(() => location.reload(), 1000);
                });
                return;
            }
            if (isFirstPoll) lastDiceResults = currentDiceResults;
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

            // Update cash
            const cashEl = playerCard.querySelector('.player-cash');
            if (cashEl) {
                cashEl.textContent = `$${player.cash.toFixed(2)}`;
            }

            // Update portfolio
            const portfolioTable = playerCard.querySelector('.portfolio-table tbody');
            if (portfolioTable && player.portfolio) {
                let html = '';
                for (const [stock, qty] of Object.entries(player.portfolio)) {
                    const stockPrice = data.data.stocks[stock] || 1.0;
                    const value = qty * stockPrice;
                    html += `
                        <tr>
                            <td class="stock-name">${stock}</td>
                            <td class="stock-qty">${qty.toLocaleString()} <small>SHRS</small></td>
                            <td class="stock-val">$${value.toFixed(2)}</td>
                        </tr>
                    `;
                }
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
                // Server returned dice data immediately
                showRollAnimation(roll.stock, roll.action, roll.amount, () => {
                    location.reload();
                });
            } else {
                // Wait for poller to catch the roll
                console.log('Waiting for dice results from server...');

                // Safety timeout - reload if animation doesn't start
                rollLockTimeout = setTimeout(() => {
                    if (!animationInProgress) {
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
        const cost = amount / 100 * price;
        costDisplay.value = `COST: $${cost.toFixed(2)}`;
        highlightActiveButton();
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
                if (stockPrices[stock] > 100) {
                    text.innerText = `${stock} ${action.toUpperCase()} ${amount}¢!`;
                } else {
                    text.innerText = `Dividends for ${stock} not payable.`;
                }
            } else {
                text.innerText = `${stock} ${action.toUpperCase()} ${amount}¢!`;
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