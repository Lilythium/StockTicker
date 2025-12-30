"""
Combined Server - Serves both Socket.IO and static files
"""

import logging
import socketio
from aiohttp import web
import os
import time

# Import game logic
from game_state import GameState

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)
logging.getLogger('socketio').setLevel(logging.ERROR)
logging.getLogger('engineio').setLevel(logging.ERROR)
logging.getLogger('aiohttp').setLevel(logging.ERROR)

# Create Socket.IO server
sio = socketio.AsyncServer(
    async_mode='aiohttp',
    cors_allowed_origins='*',
    logger=False,
    engineio_logger=False
)

# Create web application
app = web.Application()
sio.attach(app)

# Game storage
games = {}
sid_map = {}
active_joins = {}
finished_games_timestamps = {}  # Track when games finish


def get_game(game_id, player_count=4):
    """Get or create a game instance"""
    if game_id not in games:
        logger.info(f"Creating new game: {game_id}")
        games[game_id] = GameState(player_count)
    return games[game_id]


async def emit_game_state(game_id):
    """Broadcast game state to all players in game"""
    try:
        game = get_game(game_id)
        state = game.get_game_state()
        await sio.emit('game_state_update', state, room=game_id)
    except Exception as e:
        logger.error(f"Error broadcasting state: {e}")


# ===== SOCKET.IO EVENT HANDLERS =====

@sio.event
async def connect(sid, environ):
    """Handle new connection"""
    logger.info(f"✅ Client connected: {sid}")
    await sio.emit('connection_established', {'status': 'connected'}, room=sid)


@sio.event
async def disconnect(sid):
    """Handle disconnection"""
    if sid in sid_map:
        info = sid_map[sid]
        game_id = info['game_id']
        player_id = info['player_id']

        logger.info(f"❌ Client disconnected: {sid} (Player {player_id})")

        if game_id in games:
            game = games[game_id]

            # Mark player as disconnected (for both waiting and active games)
            result = game.remove_player(player_id)
            
            # Emit updated state
            await emit_game_state(game_id)
            
            # Check if we need to handle transitions (only for active games)
            if game.game_status == 'active' and not game.game_over:
                # Check if game should end due to all players leaving
                if result.get('game_over'):
                    logger.info(f"🏁 Game {game_id} ended - all players disconnected")
                    finished_games_timestamps[game_id] = time.time()
                    await sio.emit('game_over', {
                        'winner': game.winner,
                        'final_rankings': game.get_final_rankings()
                    }, room=game_id)
                else:
                    # Check for phase transitions
                    await check_and_handle_transitions(game_id)

        del sid_map[sid]


@sio.event
async def join_game(sid, data):
    """Handle player joining game"""
    try:
        game_id = str(data.get('game_id', ''))
        player_id = str(data.get('player_id', ''))
        player_name = data.get('player_name', 'Unknown')
        player_count = data.get('player_count', 4)

        logger.info(f"📥 Join request: {player_name} -> {game_id}")

        # Check if game is finished
        if game_id in games:
            game = games[game_id]
            
            if game.game_over or game.game_status == 'finished':
                # Game is finished - just send the final state, don't reset
                logger.info(f"📊 Sending finished game state for {game_id}")
                
                sid_map[sid] = {'game_id': game_id, 'player_id': player_id}
                await sio.enter_room(sid, game_id)
                
                await sio.emit('join_result', {
                    'success': True,
                    'game_state': game.get_game_state()
                }, room=sid)
                
                return

        # Game is active or waiting - proceed normally
        game = get_game(game_id, player_count)
        sid_map[sid] = {'game_id': game_id, 'player_id': player_id}
        await sio.enter_room(sid, game_id)

        result = game.add_player(player_id, player_name)

        await sio.emit('join_result', {
            'success': True,
            'game_state': game.get_game_state()
        }, room=sid)

        await emit_game_state(game_id)

    except Exception as e:
        logger.error(f"❌ Error in join_game: {e}")
        await sio.emit('join_result', {
            'success': False,
            'error': str(e)
        }, room=sid)


@sio.event
async def leave_game(sid, data):
    """Handle player leaving game"""
    try:
        game_id = data['game_id']
        player_id = data['player_id']

        logger.info(f"🚪 Leave request: {player_id}")

        game = get_game(game_id)
        
        # Mark player as disconnected
        result = game.remove_player(player_id)

        if sid in sid_map:
            del sid_map[sid]

        await sio.leave_room(sid, game_id)
        await emit_game_state(game_id)
        
        # Check if we need to handle transitions (only for active games)
        if game.game_status == 'active' and not game.game_over:
            # Check if game should end due to all players leaving
            if result.get('game_over'):
                logger.info(f"🏁 Game {game_id} ended - all players left")
                finished_games_timestamps[game_id] = time.time()
                await sio.emit('game_over', {
                    'winner': game.winner,
                    'final_rankings': game.get_final_rankings()
                }, room=game_id)
            else:
                # Check for phase transitions
                await check_and_handle_transitions(game_id)

    except Exception as e:
        logger.error(f"❌ Error in leave_game: {e}")


@sio.event
async def start_game(sid, data):
    """Start the game"""
    try:
        game_id = data['game_id']
        settings = data.get('settings', {})

        logger.info(f"🎮 Start game request: {game_id}")

        game = get_game(game_id)
        result = game.start_game(settings)

        if result.get('success'):
            await sio.emit('game_started', {
                'success': True
            }, room=game_id)

            await emit_game_state(game_id)

    except Exception as e:
        logger.error(f"❌ Error in start_game: {e}")


@sio.event
async def buy_shares(sid, data):
    """Handle buying shares"""
    try:
        game_id = data['game_id']
        game = get_game(game_id)

        result = game.buy_shares(
            data['player'],
            data['stock'],
            data['amount']
        )

        await emit_game_state(game_id)

    except Exception as e:
        logger.error(f"❌ Error in buy_shares: {e}")


@sio.event
async def sell_shares(sid, data):
    """Handle selling shares"""
    try:
        game_id = data['game_id']
        game = get_game(game_id)

        result = game.sell_shares(
            data['player'],
            data['stock'],
            data['amount']
        )

        await emit_game_state(game_id)

    except Exception as e:
        logger.error(f"❌ Error in sell_shares: {e}")


@sio.event
async def done_trading(sid, data):
    """Mark player as done trading"""
    try:
        game_id = data['game_id']
        game = get_game(game_id)

        game.mark_done_trading(data['player'])
        await emit_game_state(game_id)

        should_end, reason = game.should_end_trading_phase()
        if should_end:
            await handle_trading_end(game_id)

    except Exception as e:
        logger.error(f"❌ Error in done_trading: {e}")


@sio.event
async def roll_dice(sid, data):
    """Handle dice roll"""
    try:
        game_id = data['game_id']
        game = get_game(game_id)

        result = game.roll_dice(data.get('player'))

        if result.get('success'):
            dice_data = result.get('dice', {})

            await sio.emit('dice_rolled', {
                'stock': dice_data.get('stock'),
                'action': dice_data.get('action'),
                'amount': dice_data.get('amount'),
                'roll_id': dice_data.get('roll_id'),
                'auto': False
            }, room=game_id)

            await sio.sleep(1.5)
            await emit_game_state(game_id)

            if game.game_over:
                # Mark game as finished with timestamp
                finished_games_timestamps[game_id] = time.time()
                
                await sio.emit('game_over', {
                    'winner': game.winner,
                    'final_rankings': game.get_final_rankings()
                }, room=game_id)

    except Exception as e:
        logger.error(f"❌ Error in roll_dice: {e}")


@sio.event
async def get_state(sid, data):
    """Handle explicit state request"""
    try:
        game_id = data.get('game_id')
        if game_id and game_id in games:
            game = games[game_id]
            await sio.emit('game_state_update', game.get_game_state(), room=sid)
        else:
            await sio.emit('error', {
                'message': 'Game not found'
            }, room=sid)
    except Exception as e:
        logger.error(f"❌ Error in get_state: {e}")


async def handle_trading_end(game_id):
    """Handle end of trading phase"""
    try:
        game = get_game(game_id)
        game.change_game_phase()

        await sio.emit('phase_transition', {
            'old_phase': 'trading',
            'new_phase': 'dice',
            'message': 'Trading complete! Time to roll!'
        }, room=game_id)

        await emit_game_state(game_id)

    except Exception as e:
        logger.error(f"❌ Error in handle_trading_end: {e}")


async def handle_auto_roll(game_id):
    """Handle automatic dice roll"""
    try:
        game = get_game(game_id)
        result = game.perform_auto_roll()

        if result and result.get('success'):
            dice_data = result.get('dice', {})

            await sio.emit('dice_rolled', {
                'stock': dice_data.get('stock'),
                'action': dice_data.get('action'),
                'amount': dice_data.get('amount'),
                'auto': True
            }, room=game_id)

            await sio.sleep(1.5)
            await emit_game_state(game_id)

            if game.game_over:
                # Mark game as finished with timestamp
                finished_games_timestamps[game_id] = time.time()
                
                await sio.emit('game_over', {
                    'winner': game.winner,
                    'final_rankings': game.get_final_rankings()
                }, room=game_id)

    except Exception as e:
        logger.error(f"❌ Error in handle_auto_roll: {e}")


async def check_and_handle_transitions(game_id):
    """Check for auto-transitions"""
    try:
        game = get_game(game_id)

        if game.game_status != 'active':
            return

        if game.current_phase == 'trading':
            should_end, reason = game.should_end_trading_phase()
            if should_end:
                logger.info(f"🔄 Auto-ending trading phase for {game_id}: {reason}")
                await handle_trading_end(game_id)

        elif game.current_phase == 'dice':
            should_roll, reason = game.should_auto_roll()
            if should_roll:
                logger.info(f"🎲 Auto-rolling for {game_id}: {reason}")
                await handle_auto_roll(game_id)

    except Exception as e:
        logger.error(f"❌ Error in check_and_handle_transitions: {e}")


async def cleanup_old_games():
    """Remove finished games older than 1 hour"""
    try:
        current_time = time.time()
        games_to_remove = []
        
        for game_id, finish_time in list(finished_games_timestamps.items()):
            # Remove games finished more than 1hr ago
            if current_time - finish_time > 3600:  
                games_to_remove.append(game_id)
        
        for game_id in games_to_remove:
            if game_id in games:
                logger.info(f"🗑️ Cleaning up old finished game: {game_id}")
                del games[game_id]
            if game_id in finished_games_timestamps:
                del finished_games_timestamps[game_id]
                
    except Exception as e:
        logger.error(f"❌ Error in cleanup_old_games: {e}")


async def background_monitor():
    """Background task to check for auto-transitions and cleanup"""
    logger.info("🎮 Background monitor started")

    cleanup_counter = 0

    while True:
        try:
            await sio.sleep(1.0)

            # Check transitions every second
            for game_id, game in list(games.items()):
                if game.game_status == 'active':
                    await check_and_handle_transitions(game_id)

            # Cleanup old games every 60 seconds
            cleanup_counter += 1
            if cleanup_counter >= 60:
                await cleanup_old_games()
                cleanup_counter = 0

        except Exception as e:
            logger.error(f"❌ Error in background monitor: {e}")


# ===== STATIC FILE SERVING =====

async def index(request):
    """Serve index.html for all routes (SPA)"""
    static_dir = os.path.join(
        os.path.dirname(__file__),
        '..',
        '..',
        'web',
    )
    index_file = os.path.join(static_dir, 'index.html')
    
    if os.path.exists(index_file):
        return web.FileResponse(index_file)
    else:
        logger.error(f"Index file not found at: {index_file}")
        return web.Response(text="Index file not found", status=404)

# Setup routes
base_dir = os.path.dirname(__file__)
static_dir = os.path.join(base_dir, '..', '..', 'web')

if not os.path.exists(static_dir):
    logger.error(f"Static directory not found: {static_dir}")
    static_dir = os.path.join(os.getcwd(), 'php', 'public')
    if not os.path.exists(static_dir):
        logger.error(f"Static directory not found at fallback: {static_dir}")

logger.info(f"Serving static files from: {static_dir}")

app.router.add_static('/css', os.path.join(static_dir, 'css'))
app.router.add_static('/js', os.path.join(static_dir, 'js'))
app.router.add_static('/audio', os.path.join(static_dir, 'audio'))

app.router.add_get('/', index)
app.router.add_get('/{path:.*}', index)

async def start_background_tasks(app):
    """Start background monitor"""
    logger.info("🚀 Starting background tasks...")
    app['game_monitor'] = sio.start_background_task(background_monitor)


async def cleanup_background_tasks(app):
    """Clean up on shutdown"""
    logger.info("🛑 Shutting down...")


app.on_startup.append(start_background_tasks)
app.on_cleanup.append(cleanup_background_tasks)

if __name__ == '__main__':
    logger.info("🚀 Starting Stock Ticker server on port 9999...")
    web.run_app(app, host='0.0.0.0', port=9999)