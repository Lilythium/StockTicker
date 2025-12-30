/**
 * Lobby View - Landing page
 */

class LobbyView {
    constructor() {
        // Don't generate default ID here - wait for render
    }

    async render(container, params) {
        // Get game ID from URL or generate new one
        const gameId = params.game || SessionManager.generateGameId();
        
        console.log('🏠 Lobby rendering with params:', params, 'using gameId:', gameId);

        container.innerHTML = `
            <div class="lobby-container">
                <div class="lobby-header">
                    <h1>Stock Ticker</h1>
                </div>

                <div class="lobby-option">
                    <h2>Player Registration</h2>
                    <form id="joinForm">
                        <div class="form-group">
                            <label for="player_name">Name</label>
                            <input type="text"
                                   id="player_name"
                                   placeholder="TYPE NAME HERE..."
                                   required
                                   maxlength="20"
                                   autofocus>
                        </div>

                        <div class="form-group">
                            <label for="game_id">Game ID</label>
                            <div class="input-wrapper">
                                <input type="text"
                                       id="game_id"
                                       value="${gameId}"
                                       required
                                       maxlength="30">
                                <span class="input-icon" id="randomizeBtn" title="Roll for Random ID">🎲</span>
                            </div>
                        </div>

                        <button type="submit" class="btn-primary">
                            Join / Create Game
                        </button>
                    </form>
                </div>

                <div class="lobby-option">
                    <div class="info-box">
                        <h2>Rules</h2>
                        <ul>
                            <li><strong>2-4 Players</strong> compete for profit.</li>
                            <li>Start with <strong>$5,000</strong> cash on hand.</li>
                            <li>Trade in <strong>blocks of 500 shares</strong>.</li>
                            <li>Markets move based on <strong>dice rolls</strong>.</li>
                            <li><strong>Disconnected?</strong> You can rejoin anytime!</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;

        this.setupEventListeners();
    }

    setupEventListeners() {
        const form = document.getElementById('joinForm');
        const randomizeBtn = document.getElementById('randomizeBtn');

        // Handle form submission
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleJoin();
        });

        // Handle randomize button
        randomizeBtn.addEventListener('click', () => {
            this.playSound('click');
            document.getElementById('game_id').value = SessionManager.generateGameId();
        });

        // Play sound on button click
        form.querySelector('.btn-primary').addEventListener('click', () => {
            this.playSound('click');
        });
    }

    handleJoin() {
        const playerName = document.getElementById('player_name').value.trim();
        const gameId = document.getElementById('game_id').value.trim();

        if (!playerName) {
            alert('Please enter your name');
            return;
        }

        if (!gameId) {
            alert('Please enter a game ID');
            return;
        }

        // Generate player ID
        const playerId = SessionManager.generatePlayerId();

        // Set session
        SessionManager.setPlayer(playerId, playerName, gameId);

        // Connect to Socket.IO
        if (!window.gameSocket.connected) {
            window.gameSocket.connect();
        }

        // Join game
        window.gameSocket.joinGame(gameId, playerId, playerName);

        // Navigate to waiting room
        window.router.navigate('/waiting');
    }

    playSound(type) {
        try {
            const audio = new Audio(window.APP_CONFIG.AUDIO.ui[type]);
            audio.play().catch(e => console.log('Audio blocked'));
        } catch (e) {
            console.log('Could not play sound');
        }
    }

    cleanup() {
        // Cleanup if needed
    }
}