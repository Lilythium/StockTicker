"""
Socket.IO Game Server - FIXED VERSION
Real-time game engine with proper auto-transitions and bug fixes
"""

import socketio
import logging
from aiohttp import web
from game_state import GameState

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create Socket.IO server
sio = socketio.AsyncServer(
    async_mode='aiohttp',
    cors_allowed_origins='*',
    logger=True,
    engineio_logger=True
)

# Create aiohttp web app
app = web.Application()
sio.attach(app)

# Game state storage
games = {}

# Map socket IDs to player info for disconnect handling
# Format: { 'socket_id': {'game_id': '123', 'player_id': 1} }
sid_map = {}


def get_game(game_id, player_count=4):
    """Get or create a game instance"""
    if game_id not in games:
        games[game_id] = GameState(player_count)
    return games[game_id]


async def emit_game_state(game_id):
    """Broadcast game state to all players in a game room"""
    game = get_game(game_id)
    state = game.get_game_state()
    await sio.emit('game_state_update', state, room=game_id)
    logger.info(f"Emitted game state to room {game_id}")


@sio.event
async def connect(sid, environ):
    """Handle client connection"""
    logger.info(f"Client connected: {sid}")
    await sio.emit('connection_established', {'status': 'connected'}, room=sid)


@sio.event
async def disconnect(sid):
    """Handle client disconnection"""
    # Check if we know this socket
    if sid in sid_map:
        info = sid_map[sid]
        game_id = info['game_id']
        player_id = info['player_id']

        logger.info(f"Client disconnected: {sid} (Player {player_id} in Game {game_id})")

        if game_id in games:
            game = games[game_id]

            # Mark player as removed/offline in the game logic
            # This ensures 'has_left' becomes True in the state
            game.remove_player(player_id)

            # Broadcast the update so the UI redraws (showing "OFFLINE")
            await emit_game_state(game_id)

        # Clean up the map
        del sid_map[sid]
    else:
        logger.info(f"Client disconnected: {sid} (Unknown)")


@sio.event
async def join_game(sid, data):
    try:
        game_id = str(data.get('game_id', ''))
        player_id = str(data.get('player_id', ''))
        player_name = data.get('player_name', 'Unknown')
        player_count = data.get('player_count', 4)

        # CRITICAL FIX: Check if game is finished and reset it
        if game_id in games:
            game = games[game_id]
            if game.game_over or game.game_status == 'finished':
                logger.info(f"♻️ Game {game_id} was finished, resetting for new game...")
                # Delete the old game and create a fresh one
                del games[game_id]
                game = GameState(player_count)
                games[game_id] = game
        else:
            # Create new game
            game = get_game(game_id, player_count)

        sid_map[sid] = {'game_id': game_id, 'player_id': player_id}
        sio.enter_room(sid, game_id)

        # Rest of the existing join logic...
        existing_slot = None
        for slot, p in game.players.items():
            if p.get('player_id') == player_id:
                existing_slot = slot
                break

        if existing_slot:
            game.players[existing_slot]['has_left'] = False
            if str(existing_slot) in game.player_left_flags:
                game.player_left_flags[str(existing_slot)] = False
            logger.info(f"♻️ Player {player_name} reconnected to slot {existing_slot}")
        else:
            result = game.add_player(player_id, player_name)
            logger.info(f"✅ Player {player_name} joined: {result}")

        await sio.emit('join_result', {
            'success': True,
            'game_state': game.get_game_state()
        }, room=sid)

        await emit_game_state(game_id)

    except Exception as e:
        logger.error(f"❌ Error in join_game: {str(e)}")
        await sio.emit('join_result', {
            'success': False,
            'error': str(e)
        }, room=sid)


@sio.event
async def leave_game(sid, data):
    """
    Player manually leaves a game (clicks 'Leave Game' button)
    data: {game_id, player_id}
    """
    try:
        game_id = data['game_id']
        player_id = data['player_id']

        game = get_game(game_id)
        result = game.remove_player(player_id)

        # Remove from tracking map
        if sid in sid_map:
            del sid_map[sid]

        # Leave the Socket.IO room
        await sio.leave_room(sid, game_id)
        logger.info(f"Player {player_id} left game {game_id}")

        # Notify the leaving player
        await sio.emit('leave_result', {
            'success': True,
            'data': result
        }, room=sid)

        # Broadcast updated state to remaining players
        await emit_game_state(game_id)

        # Check if we need to auto-transition or auto-roll after player leaves
        if game.game_status == 'active':
            # If in trading phase and all remaining players are done, transition
            if game.current_phase == 'trading' and game.check_trading_phase_complete():
                logger.info(f"🔄 Trading complete after player left, changing phase...")
                game.change_game_phase()
                await sio.emit('phase_changed', {
                    'new_phase': 'dice',
                    'message': 'Trading complete! Moving to dice phase.'
                }, room=game_id)
                await emit_game_state(game_id)
            
            # If in dice phase and current player left, auto-roll
            elif game.current_phase == 'dice':
                current_turn_str = str(game.current_turn)
                if game.player_left_flags.get(current_turn_str, False):
                    logger.info(f"🎲 Current player left during their turn, auto-rolling...")
                    result = game.perform_auto_roll()
                    if result:
                        dice_data = result.get('dice', {})
                        player_name = game.get_player_name(game.current_turn)
                        await sio.emit('dice_rolled', {
                            'stock': dice_data.get('stock'),
                            'action': dice_data.get('action'),
                            'amount': dice_data.get('amount'),
                            'roll_id': dice_data.get('roll_id'),
                            'auto': True,
                            'player': player_name,
                            'player_disconnected': True
                        }, room=game_id)
                        await sio.sleep(2)
                        await emit_game_state(game_id)

    except Exception as e:
        logger.error(f"Error in leave_game: {str(e)}")
        await sio.emit('error', {'message': str(e)}, room=sid)


@sio.event
async def start_game(sid, data):
    """
    Start the game (host only)
    data: {game_id, settings}
    """
    try:
        game_id = data['game_id']
        settings = data.get('settings', {})

        game = get_game(game_id)
        result = game.start_game(settings)

        if result.get('success'):
            # Broadcast game start to all players
            await sio.emit('game_started', {
                'success': True,
                'message': 'Game has started!'
            }, room=game_id)

            # Send full state update
            await emit_game_state(game_id)
        else:
            await sio.emit('error', {
                'message': result.get('message', 'Failed to start game')
            }, room=sid)

    except Exception as e:
        logger.error(f"Error in start_game: {str(e)}")
        await sio.emit('error', {'message': str(e)}, room=sid)


@sio.event
async def buy_shares(sid, data):
    """
    Buy shares
    data: {game_id, player, stock, amount}
    """
    try:
        game_id = data['game_id']
        game = get_game(game_id)

        result = game.buy_shares(
            data['player'],
            data['stock'],
            data['amount']
        )

        # Emit result to requesting player
        await sio.emit('trade_result', {
            'success': result.get('success', True),
            'action': 'buy',
            'data': result
        }, room=sid)

        # Broadcast updated state
        await emit_game_state(game_id)

    except Exception as e:
        logger.error(f"Error in buy_shares: {str(e)}")
        await sio.emit('error', {'message': str(e)}, room=sid)


@sio.event
async def sell_shares(sid, data):
    """
    Sell shares
    data: {game_id, player, stock, amount}
    """
    try:
        game_id = data['game_id']
        game = get_game(game_id)

        result = game.sell_shares(
            data['player'],
            data['stock'],
            data['amount']
        )

        # Emit result to requesting player
        await sio.emit('trade_result', {
            'success': result.get('success', True),
            'action': 'sell',
            'data': result
        }, room=sid)

        # Broadcast updated state
        await emit_game_state(game_id)

    except Exception as e:
        logger.error(f"Error in sell_shares: {str(e)}")
        await sio.emit('error', {'message': str(e)}, room=sid)


@sio.event
async def done_trading(sid, data):
    """
    Mark player as done trading
    data: {game_id, player}
    """
    try:
        game_id = data['game_id']
        game = get_game(game_id)

        result = game.mark_done_trading(data['player'])

        # Check if trading phase should end
        if game.check_trading_phase_complete():
            logger.info(f"Trading complete in game {game_id}, changing phase...")
            game.change_game_phase()

            # Ensure last_roll_time is set
            if game.current_phase == 'dice' and game.last_roll_time is None:
                import time
                game.last_roll_time = time.time()
                logger.info(f"  ↳ Initialized last_roll_time for dice phase")

            await sio.emit('phase_changed', {
                'new_phase': 'dice',
                'message': 'Trading complete! Time to roll!'
            }, room=game_id)

        # Broadcast updated state
        await emit_game_state(game_id)

    except Exception as e:
        logger.error(f"Error in done_trading: {str(e)}")
        await sio.emit('error', {'message': str(e)}, room=sid)


@sio.event
async def roll_dice(sid, data):
    """
    Roll the dice
    data: {game_id, player}
    """
    try:
        game_id = data['game_id']
        game = get_game(game_id)

        result = game.roll_dice(data.get('player'))

        if result.get('success'):
            # Emit dice animation event
            dice_data = result.get('dice', {})
            await sio.emit('dice_rolled', {
                'stock': dice_data.get('stock'),
                'action': dice_data.get('action'),
                'amount': dice_data.get('amount'),
                'roll_id': dice_data.get('roll_id'),
                'auto': False
            }, room=game_id)

            # Wait a moment for animation, then send state update
            await sio.sleep(2)

            # IMPORTANT: Ensure last_roll_time is updated after roll
            if game.current_phase == 'dice' and game.last_roll_time is not None:
                import time
                game.last_roll_time = time.time()
                logger.info(f"  ↳ Reset last_roll_time after manual roll")

            await emit_game_state(game_id)

            # Check if game is over
            if game.game_over:
                await sio.emit('game_over', {
                    'winner': game.winner,
                    'final_rankings': game.get_final_rankings()
                }, room=game_id)
        else:
            await sio.emit('error', {
                'message': result.get('error', 'Roll failed')
            }, room=sid)

    except Exception as e:
        logger.error(f"Error in roll_dice: {str(e)}")
        await sio.emit('error', {'message': str(e)}, room=sid)


@sio.event
async def get_state(sid, data):
    """
    Manual state request (fallback)
    data: {game_id}
    """
    try:
        game_id = data['game_id']
        game = get_game(game_id)

        await sio.emit('game_state_update',
                       game.get_game_state(),
                       room=sid
                       )

    except Exception as e:
        logger.error(f"Error in get_state: {str(e)}")
        await sio.emit('error', {'message': str(e)}, room=sid)


# Background task to check for auto-actions
async def background_game_monitor():
    """Monitor games for auto-transitions and disconnects"""
    import time  # Ensure time is imported
    logger.info("🎮 Background game monitor started!")

    loop_counter = 0

    while True:
        await sio.sleep(0.5)  # Check every 0.5 seconds
        loop_counter += 1

        # --- 1. HEARTBEAT LOGIC (Every 10 seconds) ---
        # 0.5s * 20 = 10 seconds
        if loop_counter % 20 == 0:
            active_ids = [gid for gid, g in games.items() if g.game_status == 'active']
            if active_ids:
                logger.info(f"💓 Monitor heartbeat - Active games: {active_ids}")

        # --- 2. GAME MONITORING LOGIC ---
        for game_id, game in list(games.items()):
            if game.game_status != 'active':
                continue

            changed = False
            should_emit_state = False

            # A) Check trading phase completion
            if game.current_phase == 'trading':
                if game.check_trading_phase_complete():
                    logger.info(f"🔄 AUTO-TRANSITION: Trading phase complete in {game_id}")

                    # Verify players exist before transitioning
                    active_count = len(game.get_connected_slots())
                    if active_count > 0:
                        game.change_game_phase()

                        # Initialize timer for the first player in dice phase
                        if game.current_phase == 'dice':
                            game.last_roll_time = time.time()
                            logger.info(f"  ↳ Set last_roll_time for dice phase")

                        await sio.emit('phase_changed', {
                            'new_phase': 'dice',
                            'message': 'Trading complete! Moving to dice phase.'
                        }, room=game_id)

                        changed = True
                        should_emit_state = True
                    else:
                        logger.info(f"  ↳ All players disconnected, ending game")
                        game.end_game()
                        changed = True
                        should_emit_state = True

            # B) Check for auto-roll (Timer or Disconnect)
            elif game.current_phase == 'dice':
                current_player = game.current_turn
                player_name = game.get_player_name(current_player)
                is_disconnected = game.player_left_flags.get(str(current_player), False)

                if game.check_auto_roll_needed():
                    reason = "OFFLINE" if is_disconnected else "TIMER EXPIRED"
                    logger.info(f"🎲 AUTO-ROLL ({reason}) in {game_id} for {player_name}")

                    result = game.perform_auto_roll()
                    if result:
                        dice_data = result.get('dice', {})

                        # Emit the roll event
                        await sio.emit('dice_rolled', {
                            'stock': dice_data.get('stock'),
                            'action': dice_data.get('action'),
                            'amount': dice_data.get('amount'),
                            'roll_id': dice_data.get('roll_id'),
                            'auto': True,
                            'player': player_name,
                            'player_disconnected': is_disconnected
                        }, room=game_id)

                        # Wait for animation to finish
                        await sio.sleep(2)

                        # CRITICAL FIX: Reset timer for the NEXT player
                        # If we don't do this, the next player times out immediately!
                        game.last_roll_time = time.time()
                        logger.info(f"  ↳ Reset last_roll_time for next player")

                        changed = True
                        should_emit_state = True
                    else:
                        logger.error(f"  ↳ FAILED to perform auto-roll!")

            # Broadcast state if changed
            if changed and should_emit_state:
                await emit_game_state(game_id)

                if game.game_over:
                    logger.info(f"🏁 Game {game_id} ended")
                    await sio.emit('game_over', {
                        'winner': game.winner,
                        'final_rankings': game.get_final_rankings()
                    }, room=game_id)


# Start background monitor
async def start_background_tasks(app):
    """Start background tasks when server starts"""
    app['game_monitor'] = sio.start_background_task(background_game_monitor)
    logger.info("✅ Background game monitor started")

app.on_startup.append(start_background_tasks)

if __name__ == '__main__':
    logger.info("Starting Socket.IO game server on port 9999...")
    web.run_app(app, host='0.0.0.0', port=9999)
