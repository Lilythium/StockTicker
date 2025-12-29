"""
Socket.IO Game Server
"""

import logging
import socketio
from aiohttp import web

from game_state import GameState

# --- Optimized Logging Config ---
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

app = web.Application()
sio.attach(app)

# Game storage
games = {}
sid_map = {}  # socket_id -> {game_id, player_id}


def get_game(game_id, player_count=4):
    """Get or create a game instance"""
    if game_id not in games:
        logger.info(f"Creating new game: {game_id}")
        games[game_id] = GameState(player_count)
    return games[game_id]


async def emit_game_state(game_id):
    try:
        game = get_game(game_id)
        state = game.get_game_state()
        logger.info(
            f"📊 STATE [{game_id}]: Rd:{state['current_round']} | "
            f"Phase:{state['current_phase']} | "
            f"Turn:{state['current_turn']} | "
            f"Done:{state['done_trading_count']}/{state['active_player_count']}"
        )

        await sio.emit('game_state_update', state, room=game_id)
    except Exception as e:
        logger.error(f"Error broadcasting state: {e}")


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

        logger.info(f"❌ Client disconnected: {sid} (Player {player_id} in {game_id})")

        if game_id in games:
            game = games[game_id]
            game.remove_player(player_id)
            await emit_game_state(game_id)

        del sid_map[sid]
    else:
        logger.info(f"❌ Client disconnected: {sid} (unknown)")


@sio.event
async def join_game(sid, data):
    """Handle player joining game"""
    try:
        game_id = str(data.get('game_id', ''))
        player_id = str(data.get('player_id', ''))
        player_name = data.get('player_name', 'Unknown')
        player_count = data.get('player_count', 4)

        logger.info(f"📥 Join request: {player_name} -> {game_id}")

        # Check if game exists and is finished - reset if needed
        if game_id in games:
            game = games[game_id]
            if game.game_over or game.game_status == 'finished':
                logger.info(f"♻️ Resetting finished game {game_id}")
                del games[game_id]
                game = GameState(player_count)
                games[game_id] = game
        else:
            game = get_game(game_id, player_count)

        # Track this connection
        sid_map[sid] = {'game_id': game_id, 'player_id': player_id}
        sio.enter_room(sid, game_id)

        # Add or reconnect player
        result = game.add_player(player_id, player_name)
        logger.info(f"✅ Join result: {result}")

        # Send state to joining player
        await sio.emit('join_result', {
            'success': True,
            'game_state': game.get_game_state()
        }, room=sid)

        # Broadcast to room
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

        logger.info(f"🚪 Leave request: {player_id} from {game_id}")

        game = get_game(game_id)
        result = game.remove_player(player_id)

        if sid in sid_map:
            del sid_map[sid]

        await sio.leave_room(sid, game_id)

        await sio.emit('leave_result', {
            'success': True,
            'data': result
        }, room=sid)

        await emit_game_state(game_id)

        # Check for phase transitions after leave
        if game.game_status == 'active':
            await check_and_handle_transitions(game_id)

    except Exception as e:
        logger.error(f"❌ Error in leave_game: {e}")
        await sio.emit('error', {'message': str(e)}, room=sid)


@sio.event
async def start_game(sid, data):
    """Start the game"""
    try:
        game_id = data['game_id']
        settings = data.get('settings', {})

        logger.info(f"🎮 Start game request: {game_id} with {settings}")

        game = get_game(game_id)
        result = game.start_game(settings)

        if result.get('success'):
            logger.info(f"✅ Game {game_id} started!")

            await sio.emit('game_started', {
                'success': True,
                'message': 'Game has started!'
            }, room=game_id)

            await emit_game_state(game_id)
        else:
            await sio.emit('error', {
                'message': result.get('message', 'Failed to start game')
            }, room=sid)

    except Exception as e:
        logger.error(f"❌ Error in start_game: {e}")
        await sio.emit('error', {'message': str(e)}, room=sid)


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

        await sio.emit('trade_result', {
            'success': result.get('success', True),
            'action': 'buy',
            'data': result
        }, room=sid)

        await emit_game_state(game_id)

    except Exception as e:
        logger.error(f"❌ Error in buy_shares: {e}")
        await sio.emit('error', {'message': str(e)}, room=sid)


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

        await sio.emit('trade_result', {
            'success': result.get('success', True),
            'action': 'sell',
            'data': result
        }, room=sid)

        await emit_game_state(game_id)

    except Exception as e:
        logger.error(f"❌ Error in sell_shares: {e}")
        await sio.emit('error', {'message': str(e)}, room=sid)


@sio.event
async def done_trading(sid, data):
    """Mark player as done trading"""
    try:
        game_id = data['game_id']
        game = get_game(game_id)

        logger.info(f"✅ Player {data['player']} marked done trading in {game_id}")

        result = game.mark_done_trading(data['player'])

        # Always broadcast state
        await emit_game_state(game_id)

        # Check if we should transition
        should_end, reason = game.should_end_trading_phase()
        if should_end:
            logger.info(f"🔄 Trading phase ending: {reason}")
            await handle_trading_end(game_id)

    except Exception as e:
        logger.error(f"❌ Error in done_trading: {e}")
        await sio.emit('error', {'message': str(e)}, room=sid)


@sio.event
async def roll_dice(sid, data):
    """Handle dice roll"""
    try:
        game_id = data['game_id']
        game = get_game(game_id)

        logger.info(f"🎲 Roll request from player {data.get('player')} in {game_id}")

        result = game.roll_dice(data.get('player'))

        if result.get('success'):
            dice_data = result.get('dice', {})

            # Emit dice animation
            await sio.emit('dice_rolled', {
                'stock': dice_data.get('stock'),
                'action': dice_data.get('action'),
                'amount': dice_data.get('amount'),
                'roll_id': dice_data.get('roll_id'),
                'auto': False
            }, room=game_id)

            # Wait for animation
            await sio.sleep(1.5)

            # Broadcast updated state
            await emit_game_state(game_id)

            # Check for game over
            if game.game_over:
                logger.info(f"🏁 Game {game_id} has ended!")
                await sio.emit('game_over', {
                    'winner': game.winner,
                    'final_rankings': game.get_final_rankings()
                }, room=game_id)
        else:
            await sio.emit('error', {
                'message': result.get('error', 'Roll failed')
            }, room=sid)

    except Exception as e:
        logger.error(f"❌ Error in roll_dice: {e}")
        await sio.emit('error', {'message': str(e)}, room=sid)


@sio.event
async def get_state(sid, data):
    """Manual state request"""
    try:
        game_id = data['game_id']
        game = get_game(game_id)
        await sio.emit('game_state_update', game.get_game_state(), room=sid)
    except Exception as e:
        logger.error(f"❌ Error in get_state: {e}")
        await sio.emit('error', {'message': str(e)}, room=sid)


async def handle_trading_end(game_id):
    """Handle end of trading phase"""
    try:
        game = get_game(game_id)

        # Change phase
        game.change_game_phase()

        # Notify players
        await sio.emit('phase_changed', {
            'new_phase': 'dice',
            'message': 'Trading complete! Time to roll!'
        }, room=game_id)

        # Broadcast new state
        await emit_game_state(game_id)

        logger.info(f"✅ Transitioned {game_id} to dice phase")

    except Exception as e:
        logger.error(f"❌ Error in handle_trading_end: {e}")


async def handle_auto_roll(game_id):
    """Handle automatic dice roll"""
    try:
        game = get_game(game_id)
        player_name = game.get_player_name(game.current_turn)

        logger.info(f"🤖 Auto-rolling for {player_name} in {game_id}")

        result = game.perform_auto_roll()

        if result and result.get('success'):
            dice_data = result.get('dice', {})

            # Emit dice animation
            await sio.emit('dice_rolled', {
                'stock': dice_data.get('stock'),
                'action': dice_data.get('action'),
                'amount': dice_data.get('amount'),
                'roll_id': dice_data.get('roll_id'),
                'auto': True,
                'player': player_name
            }, room=game_id)

            # Wait for animation
            await sio.sleep(1.5)

            # Broadcast state
            await emit_game_state(game_id)

            # Check for game over
            if game.game_over:
                logger.info(f"🏁 Game {game_id} has ended!")
                await sio.emit('game_over', {
                    'winner': game.winner,
                    'final_rankings': game.get_final_rankings()
                }, room=game_id)

            return True
        else:
            logger.error(f"❌ Auto-roll failed for {game_id}")
            return False

    except Exception as e:
        logger.error(f"❌ Error in handle_auto_roll: {e}")
        return False


async def check_and_handle_transitions(game_id):
    """
    CENTRALIZED transition checker
    Called after any action that might trigger a transition
    """
    try:
        game = get_game(game_id)

        if game.game_status != 'active':
            return

        # Check trading phase
        if game.current_phase == 'trading':
            should_end, reason = game.should_end_trading_phase()
            if should_end:
                logger.info(f"🔄 Auto-transition: Trading -> Dice ({reason})")
                await handle_trading_end(game_id)
                return
            else:
                logger.debug(f"Still trading because: {reason}")

        # Check dice phase
        elif game.current_phase == 'dice':
            should_roll, reason = game.should_auto_roll()
            if should_roll:
                logger.info(f"🎲 Auto-roll needed ({reason})")
                await handle_auto_roll(game_id)
                return

    except Exception as e:
        logger.error(f"❌ Error in check_and_handle_transitions: {e}")


async def background_monitor():
    """
    Background task to check for auto-transitions
    Runs every 1 second
    """
    logger.info("🎮 Background monitor started!")

    check_counter = 0

    while True:
        await sio.sleep(1.0)
        check_counter += 1

        # Heartbeat every 30 seconds
        if check_counter % 30 == 0:
            active_games = [gid for gid, g in games.items() if g.game_status == 'active']
            if active_games:
                logger.info(f"💓 Monitor heartbeat - Active games: {len(active_games)}")

        # Check all active games
        for game_id, game in list(games.items()):
            if game.game_status != 'active':
                continue

            try:
                await check_and_handle_transitions(game_id)
            except Exception as e:
                logger.error(f"❌ Error checking {game_id}: {e}")


async def start_background_tasks(app):
    """Start background monitor"""
    app['game_monitor'] = sio.start_background_task(background_monitor)
    logger.info("✅ Background monitor initialized")


app.on_startup.append(start_background_tasks)

if __name__ == '__main__':
    logger.info("🚀 Starting Socket.IO game server on port 9999...")
    web.run_app(app, host='0.0.0.0', port=9999)
