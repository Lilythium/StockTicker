/**
 * Game View - Main game board
 */

class GameView {
    constructor() {
        this.currentStockPrices = {};
        this.currentPlayerCash = 0;
        this.currentPlayerSlot = null;
        this.currentPhase = null;
        this.currentTurn = null;
        this.isRedirecting = false;
        this.isProcessingState = false;
        this.pendingStateUpdate = null;
        this.animationInProgress = false;
        this.diceRollQueue = [];
        this.isProcessingRoll = false;
        this.isShaking = false;
        this.localTimerInterval = null;
        this.localTimeRemaining = 0;
        this.lastServerTime = 0;
        
        // Audio config
        this.AUDIO = {
            shakes: [
                './audio/dice_shakes/shuffle_open_1.mp3',
                './audio/dice_shakes/shuffle_open_2.mp3',
                './audio/dice_shakes/shuffle_open_3.mp3',
                './audio/dice_shakes/shuffle_open_4.mp3'
            ],
            lands: [
                './audio/dice_lands/d6_floor_1.mp3',
                './audio/dice_lands/d6_floor_2.mp3',
                './audio/dice_lands/d6_floor_3.mp3',
                './audio/dice_lands/d6_floor_4.mp3'
            ],
            ui: {
                click: './audio/button-click.ogg',
                gameOver: './audio/game-complete.mp3',
                phaseChange: './audio/game-phase-change.mp3',
                yourTurn: './audio/your-turn.mp3'
            }
        };
    }

    async render(container, params) {
        if (!SessionManager.isInGame()) {
            window.router.navigate('/');
            return;
        }

        const gameId = SessionManager.getGameId();
        const playerName = SessionManager.getPlayerName();

        container.innerHTML = `
            <!-- Header -->
            <div class="game-header">
                <div class="header-unified-bar">
                    <div class="header-section identity">
                        <span class="game-id">ID: ${gameId}</span>
                        <span class="player-name-display">${playerName}</span>
                    </div>

                    <div class="header-section phase-logic">
                        <span class="phase-label trading">🔄 LOADING...</span>
                        <div class="timer" id="timer">--:--</div>
                        <div class="players-status">0/0</div>
                        <div class="turn-status" style="display:none;">WAITING...</div>
                    </div>

                    <div class="header-section progress-exit">
                        <span class="round-display">Round 1/1</span>
                        <button id="leaveBtn" class="btn-leave">LEAVE</button>
                    </div>
                </div>
            </div>

            <!-- Action Form -->
            <div class="action-form">
                <div class="form-row three-columns">
                    <!-- Roll Column -->
                    <div class="form-column column-roll">
                        <button type="button" id="btnRollDice" class="btn-roll-ready" disabled>⏳ Loading...</button>
                    </div>

                    <!-- Trade Column -->
                    <div class="form-column column-trade">
                        <div class="trade-form">
                            <div class="trade-controls">
                                <select id="stockSelect" class="stock-select" disabled>
                                    <option value="Gold" style="background-color: #fde68a;">Gold</option>
                                    <option value="Silver" style="background-color: #d8dcdf;">Silver</option>
                                    <option value="Oil" style="background-color: #b3bce5;">Oil</option>
                                    <option value="Bonds" style="background-color: #a8d2f0;">Bonds</option>
                                    <option value="Industrials" style="background-color: #dcc2e8;">Industrials</option>
                                    <option value="Grain" style="background-color: #f6bfa6;">Grain</option>
                                </select>

                                <div class="amount-controls">
                                    <div class="custom-number-input">
                                        <input type="number" id="amountInput" value="500" class="amount-input" readonly>
                                        <div class="spin-buttons">
                                            <button type="button" class="spin-btn spin-up" disabled>▲</button>
                                            <button type="button" class="spin-btn spin-down" disabled>▼</button>
                                        </div>
                                    </div>
                                    <div class="share-quick-buttons">
                                        <button type="button" class="qty-btn" data-amount="500" disabled>500</button>
                                        <button type="button" class="qty-btn" data-amount="1000" disabled>1K</button>
                                        <button type="button" class="qty-btn" data-amount="2000" disabled>2K</button>
                                        <button type="button" class="qty-btn" data-amount="5000" disabled>5K</button>
                                    </div>
                                </div>

                                <input type="text" id="costDisplay" class="cost-display" value="COST: $0.00" readonly>

                                <div class="trade-action-buttons">
                                    <button type="button" id="btnBuy" class="btn-buy" disabled>Buy</button>
                                    <button type="button" id="btnSell" class="btn-sell" disabled>Sell</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Done Column -->
                    <div class="form-column column-done">
                        <div class="done-trading-section">
                            <div class="done-trading-control">
                                <div class="checkbox-header">
                                    <label>Done Trading?</label>
                                </div>
                                <div class="checkbox-wrapper">
                                    <input type="checkbox" id="doneTradingCheckbox" style="display:none;" disabled>
                                    <label for="doneTradingCheckbox" class="checkbox-label">
                                        <div class="checkbox-box">
                                            <span class="checkmark">✓</span>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Stock Price Board -->
            <div class="stocks_display">
                ${this.renderStockBoard()}
            </div>

            <!-- Player Cards -->
            <div class="players">
                <div class="players-container" id="playersContainer">
                    <div style="text-align: center; padding: 40px; color: #666;">
                        Loading players...
                    </div>
                </div>
            </div>

            <!-- History Bar -->
            <div class="history-bar" id="historyBar">
                <div class="history-header" onclick="window.currentGameView.toggleHistory()">
                    <span class="history-title">📜 Game History</span>
                    <span class="history-toggle" id="historyToggle">▼</span>
                </div>
                <div class="history-content" id="historyContent">
                    <div class="history-empty">Connecting...</div>
                </div>
            </div>

            <!-- Dice Overlay -->
            <div id="dice-overlay" class="dice-overlay" style="display: none;">
                <div class="dice-tray">
                    <div class="die" id="die-stock">?</div>
                    <div class="die" id="die-action">?</div>
                    <div class="die" id="die-amount">?</div>
                </div>
                <div id="dice-text" class="dice-result-text">Rolling...</div>
            </div>
        `;

        // Store reference to this view
        window.currentGameView = this;

        this.setupEventListeners();
        this.setupSocketHandlers();
        this.initializeHistoryScroll();
    }

    renderStockBoard() {
        const rows = [
            { name: 'Gold', class: 'gold', display: 'Gold' },
            { name: 'Silver', class: 'silver', display: 'Silver' },
            { name: 'Oil', class: 'oil', display: 'Oil' },
            { name: 'Bonds', class: 'bonds', display: 'Bonds' },
            { name: 'Industrials', class: 'industrials', display: 'Indust.' },
            { name: 'Grain', class: 'grain', display: 'Grain' }
        ];

        let headerRow = '<tr><th class="corner-cell"></th>';
        for (let p = 0; p <= 200; p += 5) {
            const isSpecial = [0, 100, 200].includes(p);
            headerRow += `<th class="${isSpecial ? 'price-header-special' : 'price-header'}">${p}</th>`;
        }
        headerRow += '</tr>';

        let bodyRows = '';
        rows.forEach(row => {
            bodyRows += `<tr class="stock-row ${row.class}-row">
                <th class="stock-header ${row.class}-header">${row.display}</th>`;
            
            for (let pC = 0; pC <= 200; pC += 5) {
                const special = [0, 100, 200].includes(pC);
                const label = pC === 0 ? 'Off Market' : (pC === 100 ? 'Par' : (pC === 200 ? 'Split' : ''));
                bodyRows += `<td class="price-cell ${special ? 'price-cell-special' : ''}" 
                    data-stock="${row.display}" data-price="${pC}" data-label="${label}"></td>`;
            }
            bodyRows += '</tr>';
        });

        return `<table class="stock-price-table">
            <thead>${headerRow}</thead>
            <tbody>${bodyRows}</tbody>
        </table>`;
    }

    setupEventListeners() {
        // Leave button
        document.getElementById('leaveBtn').addEventListener('click', () => {
            if (confirm('Leave game?')) {
                this.leaveGame();
            }
        });

        // Trade controls
        const stockSelect = document.getElementById('stockSelect');
        const amountInput = document.getElementById('amountInput');
        const btnBuy = document.getElementById('btnBuy');
        const btnSell = document.getElementById('btnSell');
        const btnRoll = document.getElementById('btnRollDice');
        const doneCheckbox = document.getElementById('doneTradingCheckbox');

        stockSelect.addEventListener('change', () => {
            this.playSound('click');
            this.updateStockSelectColor();
            this.updateCostDisplay();
        });

        btnBuy.addEventListener('click', () => {
            this.playSound('click');
            window.gameSocket.buyShares(stockSelect.value, parseInt(amountInput.value));
        });

        btnSell.addEventListener('click', () => {
            this.playSound('click');
            window.gameSocket.sellShares(stockSelect.value, parseInt(amountInput.value));
        });

        btnRoll.addEventListener('click', () => {
            this.playSound('click');
            window.gameSocket.rollDice();
            btnRoll.disabled = true;
            btnRoll.textContent = '🎲 Rolling...';
        });

        doneCheckbox.addEventListener('change', () => {
            if (doneCheckbox.checked) {
                this.playSound('click');
                window.gameSocket.markDoneTrading();
                doneCheckbox.disabled = true;
                const box = document.querySelector('.checkbox-box');
                if (box) box.classList.add('checked');
                const label = document.querySelector('.checkbox-header label');
                if (label) label.textContent = 'Trading Complete';
                this.disableTradingControls();
            }
        });

        // Checkbox box click handler
        const checkboxBox = document.querySelector('.checkbox-box');
        if (checkboxBox) {
            checkboxBox.addEventListener('click', () => {
                if (!doneCheckbox.disabled && !doneCheckbox.checked) {
                    doneCheckbox.checked = true;
                    doneCheckbox.dispatchEvent(new Event('change'));
                }
            });
        }

        // Spin buttons
        document.querySelector('.spin-up').addEventListener('click', () => {
            this.playSound('click');
            let val = parseInt(amountInput.value) || 0;
            amountInput.value = val + 500;
            this.updateCostDisplay();
        });

        document.querySelector('.spin-down').addEventListener('click', () => {
            this.playSound('click');
            let val = parseInt(amountInput.value) || 0;
            if (val >= 500) amountInput.value = val - 500;
            this.updateCostDisplay();
        });

        // Quantity buttons
        document.querySelectorAll('.qty-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.playSound('click');
                amountInput.value = btn.getAttribute('data-amount');
                this.updateCostDisplay();
            });
        });

        // Initialize displays
        setTimeout(() => {
            this.updateStockSelectColor();
            this.updateCostDisplay();
        }, 100);
    }

    setupSocketHandlers() {
        window.gameSocket.onStateUpdate = (state) => {
            this.handleGameStateUpdate(state);
        };

        window.gameSocket.onDiceRolled = (data) => {
            this.queueDiceRoll(data.stock, data.action, data.amount);
        };

        window.gameSocket.onPhaseChanged = (data) => {
            this.playSound('phaseChange');
            this.handlePhaseChange(data.old_phase, data.new_phase);
        };

        window.gameSocket.onGameOver = (data) => {
            if (!this.isRedirecting) {
                this.isRedirecting = true;
                this.playSound('gameOver');
                
                if (this.localTimerInterval) {
                    clearInterval(this.localTimerInterval);
                    this.localTimerInterval = null;
                }
                
                setTimeout(() => {
                    window.router.navigate('/game-over');
                }, 2000);
            }
        };
    }

    async handleGameStateUpdate(state) {
        if (this.isProcessingState) {
            this.pendingStateUpdate = state;
            return;
        }

        this.isProcessingState = true;

        try {
            await this.processGameState(state);
        } catch (error) {
            console.error('❌ Error processing state:', error);
        } finally {
            this.isProcessingState = false;

            if (this.pendingStateUpdate) {
                const pending = this.pendingStateUpdate;
                this.pendingStateUpdate = null;
                setTimeout(() => this.handleGameStateUpdate(pending), 50);
            }
        }
    }

    async processGameState(state) {
        if (!state || this.isRedirecting) return;

        // Handle game over
        if (state.game_over) {
            if (!this.isRedirecting) {
                this.isRedirecting = true;
                if (this.localTimerInterval) {
                    clearInterval(this.localTimerInterval);
                }
                this.playSound('gameOver');
                setTimeout(() => {
                    window.router.navigate('/game-over');
                }, 1500);
            }
            return;
        }

        // Check if game hasn't started
        if (state.status === 'waiting') {
            window.router.navigate('/waiting');
            return;
        }

        // Identify player slot
        if (this.currentPlayerSlot === null && state.players) {
            const playerId = SessionManager.getPlayerId();
            for (const [slot, player] of Object.entries(state.players)) {
                if (player.player_id === playerId) {
                    this.currentPlayerSlot = parseInt(slot);
                    SessionManager.setPlayerSlot(parseInt(slot));
                    console.log(`✅ Player slot: ${this.currentPlayerSlot}`);
                    break;
                }
            }
        }

        // Track phase/turn
        this.currentPhase = state.current_phase;
        this.currentTurn = state.current_turn;

        // Update UI
        if (state.stocks) {
            this.currentStockPrices = state.stocks;
            this.updateStockDisplay(state.stocks);
        }

        if (state.players) {
            this.updatePlayerCardsUI(state.players, state.stocks);

            const mySlot = this.currentPlayerSlot?.toString();
            if (mySlot && state.players[mySlot]) {
                this.currentPlayerCash = state.players[mySlot].cash || 0;
                const myDoneTrading = state.players[mySlot].done_trading || false;
                this.updateDoneTradingCheckbox(myDoneTrading);
                
                if (myDoneTrading && state.current_phase === 'trading') {
                    this.disableTradingControls();
                }
            }
        }

        if (state.history) {
            this.renderHistory(state.history);
        }

        this.updateRollButton(state);
        this.updatePhaseLabel(state.current_phase);
        this.updateDoneTradingCount(state);
        this.updateTimerDisplay(state);
        this.updateTurnStatus(state);
        this.updateRoundDisplay(state);

        // Enable/disable controls
        if (state.current_phase === 'trading') {
            const mySlot = this.currentPlayerSlot?.toString();
            const isDone = mySlot && state.players[mySlot]?.done_trading;

            if (!isDone) {
                this.enableTradingControls();
            } else {
                this.disableTradingControls();
            }
        } else if (state.current_phase === 'dice') {
            this.disableTradingControls();
        }

        setTimeout(() => this.updateCostDisplay(), 50);
    }

    updateStockDisplay(stocks) {
        Object.keys(stocks).forEach(stockName => {
            const priceCents = Math.round((stocks[stockName] || 1) * 100);
            let displayName = stockName === 'Industrials' ? 'Indust.' : stockName;

            const stockCells = document.querySelectorAll(`td[data-stock="${displayName}"]`);
            stockCells.forEach(cell => {
                cell.classList.remove('current-price');
                const marker = cell.querySelector('.price-marker');
                if (marker) marker.remove();
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

    updatePlayerCardsUI(players, stocks) {
        const container = document.getElementById('playersContainer');
        if (!container) return;

        let html = '';
        const playerId = SessionManager.getPlayerId();

        Object.keys(players).forEach(slot => {
            const p = players[slot];
            if (!p.player_id) return;

            const isMe = (p.player_id === playerId);
            const isOff = p.has_left || false;
            const isDone = p.done_trading || false;

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
            <div class="player-card ${isMe ? 'current-player' : ''} ${isOff ? 'disconnected' : ''}">
                <div class="player-header-row">
                    <div class="player-identity">
                        <span class="player-name">${p.name}</span>
                        ${isMe ? '<span class="you-badge">YOU</span>' : ''}
                        ${isOff ? '<span class="disconnected-badge">OFFLINE</span>' : ''}
                        ${(isDone && this.currentPhase === 'trading') ? '<span class="done-check">✅</span>' : ''}
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

    updateRollButton(state) {
        const btnRoll = document.getElementById('btnRollDice');
        if (!btnRoll) return;

        const isMyTurn = (state.current_turn == this.currentPlayerSlot);
        const isDicePhase = (state.current_phase === 'dice');

        if (!isMyTurn) {
            btnRoll.disabled = true;
            btnRoll.textContent = '⏳ Not Your Turn';
        } else if (isDicePhase) {
            btnRoll.disabled = false;
            btnRoll.textContent = '🎲 ROLL!';
        } else {
            btnRoll.disabled = true;
            btnRoll.textContent = '⏳ Trading Phase';
        }
    }

    updatePhaseLabel(phase) {
        const label = document.querySelector('.phase-label');
        if (label) {
            label.className = `phase-label ${phase}`;
            label.textContent = phase === 'trading' ? '🔄 TRADING' : '🎲 DICE';
        }
    }

    updateDoneTradingCount(state) {
        const elem = document.querySelector('.players-status');
        if (!elem) return;

        if (state.current_phase === 'trading') {
            const done = state.done_trading_count || 0;
            const active = state.connected_player_count || 0;
            elem.textContent = `${done}/${active} Ready`;
            elem.style.display = '';
        } else {
            elem.style.display = 'none';
        }
    }

    updateTurnStatus(state) {
        const elem = document.querySelector('.turn-status');
        if (!elem) return;

        if (state.current_phase === 'dice') {
            const isMyTurn = (state.current_turn == this.currentPlayerSlot);
            elem.innerHTML = isMyTurn ? '<span class="your-turn-pulse">YOUR TURN</span>' : 'WAITING...';
            elem.style.display = '';
        } else {
            elem.style.display = 'none';
        }
    }

    updateRoundDisplay(state) {
        const elem = document.querySelector('.round-display');
        if (elem) {
            elem.textContent = `Round ${state.current_round || 1}/${state.max_rounds || 15}`;
        }
    }

    updateTimerDisplay(state) {
        const timerDisplay = document.getElementById('timer');
        if (!timerDisplay || state.time_remaining === undefined) return;

        if (this.localTimerInterval) {
            clearInterval(this.localTimerInterval);
            this.localTimerInterval = null;
        }

        const serverTime = Math.floor(state.time_remaining);
        this.lastServerTime = serverTime;
        this.localTimeRemaining = serverTime;
        
        this.displayTimer(this.localTimeRemaining);
        
        if (serverTime > 0 && state.status === 'active') {
            this.localTimerInterval = setInterval(() => {
                this.localTimeRemaining = Math.max(0, this.localTimeRemaining - 1);
                this.displayTimer(this.localTimeRemaining);
                
                if (this.localTimeRemaining <= 0) {
                    clearInterval(this.localTimerInterval);
                    this.localTimerInterval = null;
                }
            }, 1000);
        }
    }

    displayTimer(seconds) {
        const timerDisplay = document.getElementById('timer');
        if (!timerDisplay) return;
        
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        timerDisplay.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        timerDisplay.style.color = (seconds <= 10 && seconds > 0) ? '#ef4444' : '';
    }

    updateDoneTradingCheckbox(isDone) {
        const checkbox = document.getElementById('doneTradingCheckbox');
        const checkboxBox = document.querySelector('.checkbox-box');
        const label = document.querySelector('.checkbox-header label');

        if (!checkbox) return;

        if (isDone) {
            checkbox.checked = true;
            checkbox.disabled = true;
            if (checkboxBox) checkboxBox.classList.add('checked');
            if (label) label.textContent = 'Trading Complete';
        } else {
            checkbox.checked = false;
            if (this.currentPhase === 'trading') {
                checkbox.disabled = false;
            }
            if (checkboxBox) checkboxBox.classList.remove('checked');
            if (label) label.textContent = 'Done Trading?';
        }
    }

    enableTradingControls() {
        const stockSelect = document.getElementById('stockSelect');
        const btnBuy = document.getElementById('btnBuy');
        const btnSell = document.getElementById('btnSell');
        const qtyButtons = document.querySelectorAll('.qty-btn');
        const spinButtons = document.querySelectorAll('.spin-btn');
        const doneCheckbox = document.getElementById('doneTradingCheckbox');

        if (stockSelect) stockSelect.disabled = false;
        if (btnBuy) btnBuy.disabled = false;
        if (btnSell) btnSell.disabled = false;
        if (doneCheckbox && !doneCheckbox.checked) doneCheckbox.disabled = false;

        qtyButtons.forEach(btn => btn.disabled = false);
        spinButtons.forEach(btn => btn.disabled = false);

        const form = document.querySelector('.action-form');
        if (form) form.classList.remove('form-disabled');
    }

    disableTradingControls() {
        const stockSelect = document.getElementById('stockSelect');
        const btnBuy = document.getElementById('btnBuy');
        const btnSell = document.getElementById('btnSell');
        const qtyButtons = document.querySelectorAll('.qty-btn');
        const spinButtons = document.querySelectorAll('.spin-btn');

        if (stockSelect) stockSelect.disabled = true;
        if (btnBuy) btnBuy.disabled = true;
        if (btnSell) btnSell.disabled = true;

        qtyButtons.forEach(btn => btn.disabled = true);
        spinButtons.forEach(btn => btn.disabled = true);

        const form = document.querySelector('.action-form');
        if (form) form.classList.add('form-disabled');
    }

    updateStockSelectColor() {
        const stockSelect = document.getElementById('stockSelect');
        if (!stockSelect) return;

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

        const selectedClass = stockClassMap[stockSelect.value];
        if (selectedClass) {
            stockSelect.classList.add(selectedClass);
        }
    }

    updateCostDisplay() {
        const stockSelect = document.getElementById('stockSelect');
        const amountInput = document.getElementById('amountInput');
        const costDisplay = document.getElementById('costDisplay');

        if (!stockSelect || !amountInput || !costDisplay) return;

        const selectedStock = stockSelect.value;
        const amount = parseInt(amountInput.value) || 0;
        const stockPrice = this.currentStockPrices[selectedStock] || 0.00;
        const totalCost = amount * stockPrice;

        costDisplay.value = `COST: $${totalCost.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;

        if (totalCost > this.currentPlayerCash && amount > 0) {
            costDisplay.style.color = '#ef4444';
            costDisplay.style.fontWeight = 'bold';
        } else {
            costDisplay.style.color = '';
            costDisplay.style.fontWeight = '';
        }
    }

    handlePhaseChange(oldPhase, newPhase) {
        console.log(`🎯 Phase change: ${oldPhase} → ${newPhase}`);

        if (newPhase === 'trading') {
            this.resetDoneTradingCheckbox();
            this.enableTradingControls();
        } else if (newPhase === 'dice') {
            this.disableTradingControls();
        }
    }

    resetDoneTradingCheckbox() {
        const checkbox = document.getElementById('doneTradingCheckbox');
        const checkboxBox = document.querySelector('.checkbox-box');
        const label = document.querySelector('.checkbox-header label');

        if (checkbox) {
            checkbox.checked = false;
            checkbox.disabled = false;
        }

        if (checkboxBox) {
            checkboxBox.classList.remove('checked');
        }

        if (label) {
            label.textContent = 'Done Trading?';
        }
    }

    // Dice Animation
    queueDiceRoll(stock, action, amount) {
        console.log('🎲 Queueing dice roll:', { stock, action, amount });
        this.diceRollQueue.push({ stock, action, amount });
        this.processNextRoll();
    }

    processNextRoll() {
        if (this.isProcessingRoll || this.diceRollQueue.length === 0) return;

        this.isProcessingRoll = true;
        const roll = this.diceRollQueue.shift();

        this.showRollAnimation(roll.stock, roll.action, roll.amount, () => {
            this.isProcessingRoll = false;
            if (this.diceRollQueue.length > 0) {
                setTimeout(() => this.processNextRoll(), 500);
            }
        });
    }

    showRollAnimation(stock, action, amount, callback) {
        this.startInstantShaking();
        setTimeout(() => {
            this.revealWhenReady(stock, action, amount, callback);
        }, 1000);
    }

    startInstantShaking() {
        const overlay = document.getElementById('dice-overlay');
        const dice = [
            document.getElementById('die-stock'),
            document.getElementById('die-action'),
            document.getElementById('die-amount')
        ];
        const text = document.getElementById('dice-text');

        if (!overlay) return;

        this.isShaking = true;
        this.animationInProgress = true;
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

        this.playShakeSounds();
    }

    playShakeSounds() {
        if (!this.isShaking) return;

        const snd = this.playSound('shakes');
        if (snd) snd.volume = Math.random() * 0.3 + 0.7;

        const nextGap = Math.random() * 50 + 40;
        setTimeout(() => this.playShakeSounds(), nextGap);
    }

    async revealWhenReady(stock, action, amount, callback) {
        const dice = {
            stock: document.getElementById('die-stock'),
            action: document.getElementById('die-action'),
            amount: document.getElementById('die-amount')
        };
        const text = document.getElementById('dice-text');

        setTimeout(() => {
            this.revealDie(dice.stock, (stock === "Industrials" ? "Indust." : stock).toUpperCase());
        }, 200);

        setTimeout(() => {
            this.revealDie(dice.action, action.toUpperCase());
        }, 500);

        this.isShaking = false;

        setTimeout(() => {
            this.revealDie(dice.amount, amount + '¢');

            if (text) {
                text.classList.add('reveal-text');
                if (action.toUpperCase() === "DIV") {
                    const stockPrice = this.currentStockPrices[stock] || 0;
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

                this.animationInProgress = false;
                if (callback) callback();
            }, 1500);
        }, 800);
    }

    revealDie(el, val) {
        this.playSound('lands');
        if (!el) return;
        el.classList.remove('rolling');
        el.classList.add('die-reveal');
        el.innerText = val;
    }

    // History
    initializeHistoryScroll() {
        const historyContent = document.getElementById('historyContent');
        if (!historyContent) return;

        historyContent.scrollTop = historyContent.scrollHeight;

        historyContent.addEventListener('scroll', function() {
            const isNearBottom = this.scrollHeight - this.scrollTop - this.clientHeight < 10;
            this.isUserScrolled = !isNearBottom;
        });
    }

    renderHistory(history) {
        const historyContent = document.getElementById('historyContent');
        if (!historyContent) return;

        if (!history || history.length === 0) {
            historyContent.innerHTML = '<div class="history-empty">No events yet...</div>';
            return;
        }

        let html = '';
        history.forEach(entry => {
            const type = entry.type || 'event';
            const timestamp = entry.timestamp ? new Date(entry.timestamp * 1000).toLocaleTimeString() : '';
            const message = entry.message || entry;
            html += `<div class="history-entry event-${type}">${timestamp ? '[' + timestamp + '] ' : ''}${message}</div>`;
        });

        const wasAtBottom = historyContent.scrollHeight - historyContent.scrollTop - historyContent.clientHeight < 10;
        historyContent.innerHTML = html;

        if (!historyContent.isUserScrolled || wasAtBottom) {
            historyContent.scrollTop = historyContent.scrollHeight;
        }
    }

    toggleHistory() {
        const historyBar = document.getElementById('historyBar');
        const historyContent = document.getElementById('historyContent');

        if (historyBar && historyContent) {
            const wasAtBottom = historyContent.scrollHeight - historyContent.scrollTop - historyContent.clientHeight < 10;
            historyBar.classList.toggle('expanded');
            setTimeout(() => {
                if (wasAtBottom || !historyContent.isUserScrolled) {
                    historyContent.scrollTop = historyContent.scrollHeight;
                }
            }, 300);
        }
    }

    playSound(type) {
        let file;
        if (this.AUDIO[type]) {
            const entry = this.AUDIO[type];
            file = Array.isArray(entry) ? entry[Math.floor(Math.random() * entry.length)] : entry;
        } else if (this.AUDIO.ui[type]) {
            file = this.AUDIO.ui[type];
        } else {
            file = type;
        }
        
        const audio = new Audio(file);
        audio.play().catch(e => console.log("Audio blocked"));
        return audio;
    }

    leaveGame() {
        window.gameSocket.leaveGame();
        SessionManager.clear();
        window.router.navigate('/');
    }

    cleanup() {
        // Clear timer
        if (this.localTimerInterval) {
            clearInterval(this.localTimerInterval);
            this.localTimerInterval = null;
        }

        // Clear socket handlers
        window.gameSocket.onStateUpdate = null;
        window.gameSocket.onDiceRolled = null;
        window.gameSocket.onPhaseChanged = null;
        window.gameSocket.onGameOver = null;

        // Clear reference
        window.currentGameView = null;
    }
}