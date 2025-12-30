/**
 * Global Configuration
 * Single source of truth for app settings
 */

window.APP_CONFIG = {
    // Socket.IO server URL
    SOCKETIO_SERVER: window.location.origin,
    
    // Audio paths
    AUDIO: {
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
            gameStart: './audio/game-start.mp3',
            yourTurn: './audio/your-turn.mp3'
        }
    },
    
    // Default game settings
    DEFAULT_SETTINGS: {
        max_rounds: 15,
        trading_duration: 2,
        dice_duration: 15,
        starting_cash: 5000,
        player_count: 4
    },
    
    // Stock colors for UI
    STOCK_COLORS: {
        'Gold': '#fde68a',
        'Silver': '#d8dcdf',
        'Oil': '#b3bce5',
        'Bonds': '#a8d2f0',
        'Industrials': '#dcc2e8',
        'Grain': '#f6bfa6'
    }
};