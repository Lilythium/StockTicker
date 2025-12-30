/**
 * Application Bootstrap
 * Initializes the app and sets up routing
 */

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Stock Ticker - Initializing...');

    // Register routes
    window.router.register('/', LobbyView);
    window.router.register('/waiting', WaitingRoomView);
    window.router.register('/game', GameView);
    window.router.register('/game-over', GameOverView);

    // Initialize router
    window.router.init();

    // Setup global socket event handlers
    setupGlobalSocketHandlers();

	// Auto-connect socket if we have session data
    if (SessionManager.isInGame()) {
        console.log('📡 Session found, connecting to server...');
        if (!window.gameSocket.connected) {
            window.gameSocket.connect();
        }
    }

    console.log('✅ Stock Ticker - Ready!');
});

/**
 * Setup socket handlers that apply across all views
 */
function setupGlobalSocketHandlers() {
    // Handle connection changes
    window.gameSocket.onConnectionChange = (connected) => {
        if (connected) {
            console.log('✅ Connected to server');
            showConnectionStatus('Connected', 'success');
        } else {
            console.log('❌ Disconnected from server');
            showConnectionStatus('Disconnected - Reconnecting...', 'error');
        }
    };

    // Handle errors
    window.gameSocket.onError = (message) => {
        console.error('❌ Socket error:', message);
        showError(message);
    };
}

/**
 * Show connection status notification
 */
function showConnectionStatus(message, type) {
    // Remove existing status
    const existing = document.getElementById('connectionStatus');
    if (existing) existing.remove();

    // Create new status
    const status = document.createElement('div');
    status.id = 'connectionStatus';
    status.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        padding: 10px 20px;
        border-radius: 5px;
        font-weight: bold;
        z-index: 10000;
        animation: slideIn 0.3s;
        ${type === 'success' ? 'background: #2ecc71; color: white;' : 'background: #e74c3c; color: white;'}
    `;
    status.textContent = message;

    document.body.appendChild(status);

    // Auto-remove after 3 seconds if success
    if (type === 'success') {
        setTimeout(() => {
            status.style.animation = 'slideOut 0.3s';
            setTimeout(() => status.remove(), 300);
        }, 3000);
    }
}

/**
 * Show error message
 */
function showError(message) {
    const existing = document.querySelector('.global-error');
    if (existing) existing.remove();

    const error = document.createElement('div');
    error.className = 'global-error';
    error.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #f8d7da;
        color: #721c24;
        padding: 20px 30px;
        border: 3px solid #f5c6cb;
        border-radius: 5px;
        font-weight: bold;
        z-index: 10001;
        max-width: 500px;
        text-align: center;
        box-shadow: 0 5px 20px rgba(0,0,0,0.3);
    `;
    error.innerHTML = `
        <div style="font-size: 18px; margin-bottom: 10px;">⚠️ Error</div>
        <div>${message}</div>
        <button onclick="this.parentElement.remove()" style="
            margin-top: 15px;
            padding: 8px 20px;
            background: #c82333;
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-weight: bold;
        ">Close</button>
    `;

    document.body.appendChild(error);
}

/**
 * Add CSS animations
 */
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }

    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }
`;
document.head.appendChild(style);

// Make helper functions globally available
window.showError = showError;
window.showConnectionStatus = showConnectionStatus;