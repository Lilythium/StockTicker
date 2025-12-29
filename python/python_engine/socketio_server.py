"""
Socket.IO Game Server
"""

import logging
import socketio
from aiohttp import web
import time

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
active_joins = {}


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

            if game.game_status == 'waiting':
                game.remove_player(player_id)
                await emit_game_state(game_id)
            else:
                logger.info(f"   Player can reconnect to active game")
                await emit_game_state(game_id)

        del sid_map[sid]
    else:
        logger.info(f"❌ Client disconnected: {sid} (unknown)")

    if sid in active_joins:
        del active_joins[sid]


@sio.event
async def join_game(sid, data):
    """Handle player joining game"""
    try:
        game_id = str(data.get('game_id', ''))
        player_id = str(data.get('player_id', ''))
        player_name = data.get('player_name', 'Unknown')
        player_count = data.get('player_count', 4)

        # DEDUPLICATION
        if sid in active_joins:
            prev_game, prev_player, prev_time = active_joins[sid]
            elapsed = time.time() - prev_time

            if prev_game == game_id and prev_player == player_id and elapsed < 2.0:
                logger.warning(f"⚠️ Duplicate join request from {sid} for {game_id} (ignored)")
                return

        active_joins[sid] = (game_id, player_id, time.time())

        logger.info(f"📥 Join request: {player_name} -> {game_id}")

        # Reset finished games
        if game_id in games:
            game = games[game_id]
            if game.game_over or game.game_status == 'finished':
                logger.info(f"♻️ Resetting finished game {game_id}")
                del games[game_id]
                game = GameState(player_count)
                games[game_id] = game
        else:
            game = get_game(game_id, player_count)

        sid_map[sid] = {'game_id': game_id, 'player_id': player_id}
        await sio.enter_room(sid, game_id)

        result = game.add_player(player_id, player_name)
        logger.info(f"✅ Join result: {result}")

        await sio.emit('join_result', {
            'success': True,
            'game_state': game.get_game_state()
        }, room=sid)

        await emit_game_state(game_id)

    except Exception as e:
        logger.error(f"❌ Error in join_game: {e}")
        import traceback
        logger.error(traceback.format_exc())

        await sio.emit('join_result', {
            'success': False,
            'error': str(e)
        }, room=sid)
    finally:
        async def cleanup_join_tracking(target_sid):
            await sio.sleep(3.0)
            active_joins.pop(target_sid, None)

        sio.start_background_task(cleanup_join_tracking, sid)


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

        logger.info(f"   Current status: {game.game_status}")
        logger.info(f"   Active players: {len(game.get_active_slots())}")

        result = game.start_game(settings)

        if result.get('success'):
            logger.info(f"✅ Game {game_id} started!")
            logger.info(f"   New status: {game.game_status}")
            logger.info(f"   Phase: {game.current_phase}")
            logger.info(f"   Timer start: {game.phase_timer_start}")
            logger.info(f"   Phase duration: {game.phase_duration}s")

            await sio.emit('game_started', {
                'success': True,
                'message': 'Game has started!'
            }, room=game_id)

            await emit_game_state(game_id)
        else:
            logger.error(f"❌ Failed to start game {game_id}: {result.get('message')}")
            await sio.emit('error', {
                'message': result.get('message', 'Failed to start game')
            }, room=sid)

    except Exception as e:
        logger.error(f"❌ Error in start_game: {e}")
        import traceback
        logger.error(traceback.format_exc())
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

        await emit_game_state(game_id)

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
    """Handle end of trading phase - SERVER CONTROLLED"""
    try:
        game = get_game(game_id)

        logger.info(f"🔄 SERVER: Ending trading phase for {game_id}")

        # Change phase
        game.change_game_phase()

        # Emit explicit phase transition event
        await sio.emit('phase_transition', {
            'old_phase': 'trading',
            'new_phase': 'dice',
            'message': 'Trading complete! Time to roll!',
            'timestamp': time.time()
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

            await sio.emit('dice_rolled', {
                'stock': dice_data.get('stock'),
                'action': dice_data.get('action'),
                'amount': dice_data.get('amount'),
                'roll_id': dice_data.get('roll_id'),
                'auto': True,
                'player': player_name
            }, room=game_id)

            await sio.sleep(1.5)

            await emit_game_state(game_id)

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
    CENTRALIZED transition checker - SERVER CONTROLLED
    Called by background monitor
    """
    try:
        game = get_game(game_id)

        if game.game_status != 'active':
            return

        # Check trading phase
        if game.current_phase == 'trading':
            should_end, reason = game.should_end_trading_phase()
            if should_end:
                logger.info(f"🔄 SERVER: Auto-transition Trading -> Dice ({reason})")
                await handle_trading_end(game_id)
                return

        # Check dice phase
        elif game.current_phase == 'dice':
            should_roll, reason = game.should_auto_roll()
            if should_roll:
                logger.info(f"🎲 SERVER: Auto-roll needed ({reason})")
                await handle_auto_roll(game_id)
                return

    except Exception as e:
        logger.error(f"❌ Error in check_and_handle_transitions: {e}")


async def background_monitor():
    """
    Background task to check for auto-transitions
    This is the SERVER-SIDE TIMER
    """
    logger.info("🎮 SERVER TIMER STARTED - Background monitor running!")

    check_counter = 0

    while True:
        try:
            await sio.sleep(1.0)
            check_counter += 1

            # Heartbeat every 10 seconds
            if check_counter % 10 == 0:
                active_games = [gid for gid, g in games.items() if g.game_status == 'active']
                logger.info(f"💓 HEARTBEAT #{check_counter} - Active games: {len(active_games)}")

                if active_games:
                    for gid in active_games:
                        g = games[gid]
                        logger.info(f"   └─ {gid}: Phase={g.current_phase}, "
                                    f"Round={g.current_round}/{g.max_rounds}, "
                                    f"Timer={int(g.get_time_remaining())}s")

            # Check all active games for transitions
            for game_id, game in list(games.items()):
                if game.game_status != 'active':
                    continue

                # Let the server handle transitions automatically
                await check_and_handle_transitions(game_id)

        except Exception as e:
            logger.error(f"❌ Error in background monitor: {e}")
            import traceback
            logger.error(traceback.format_exc())


async def start_background_tasks(app):
    """Start background monitor"""
    logger.info("🚀 Starting SERVER TIMER...")
    app['game_monitor'] = sio.start_background_task(background_monitor)
    logger.info("✅ SERVER TIMER active")

    await sio.sleep(0.5)
    logger.info("✅ Background monitor initialization complete")


async def cleanup_background_tasks(app):
    """Clean up on shutdown"""
    logger.info("🛑 Shutting down background tasks...")


app.on_startup.append(start_background_tasks)
app.on_cleanup.append(cleanup_background_tasks)

if __name__ == '__main__':
    logger.info("🚀 Starting Socket.IO game server on port 9999...")
    web.run_app(app, host='0.0.0.0', port=9999)