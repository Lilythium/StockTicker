"""
Socket.IO Game Server - FIXED VERSION
Real-time game engine with proper auto-transitions
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
    logger.info(f"Client disconnected: {sid}")


@sio.event
async def join_game(sid, data):
    """
    Player joins a game room
    data: {game_id, player_id, player_name, player_count}
    """
    try:
        game_id = data['game_id']
        player_id = data['player_id']
        player_name = data['player_name']
        player_count = data.get('player_count', 4)

        # Enter the Socket.IO room
        await sio.enter_room(sid, game_id)
        logger.info(f"Player {player_name} ({sid}) joined game {game_id}")

        # Get or create game
        game = get_game(game_id, player_count)

        # Check if this is a rejoin or new join
        response = game.add_player(player_id, player_name)

        # Emit to the joining player
        await sio.emit('join_result', {
            'success': True,
            'data': response,
            'game_state': game.get_game_state()
        }, room=sid)

        # Broadcast updated state to all players in the room
        await emit_game_state(game_id)

    except Exception as e:
        logger.error(f"Error in join_game: {str(e)}")
        await sio.emit('error', {'message': str(e)}, room=sid)


@sio.event
async def leave_game(sid, data):
    """
    Player leaves a game
    data: {game_id, player_id}
    """
    try:
        game_id = data['game_id']
        player_id = data['player_id']

        game = get_game(game_id)
        result = game.remove_player(player_id)

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
    while True:
        await sio.sleep(1)  # Check every 1 second for faster response

        for game_id, game in list(games.items()):
            if game.game_status != 'active':
                continue

            changed = False

            # Check trading phase completion (TIMER EXPIRED)
            if game.current_phase == 'trading' and game.check_trading_phase_complete():
                logger.info(f"🔄 Auto-transition: Trading phase complete in {game_id}")
                game.change_game_phase()
                await sio.emit('phase_changed', {
                    'new_phase': 'dice',
                    'message': 'Trading time expired! Moving to dice phase.'
                }, room=game_id)
                changed = True

            # Check for auto-roll (disconnected player or timer expired)
            if game.current_phase == 'dice':
                # DEBUG: Log current state
                current_player = game.current_turn
                player_name = game.get_player_name(current_player)
                is_disconnected = game.player_left_flags.get(str(current_player), False)

                logger.info(f"🎲 Dice phase check for {game_id}:")
                logger.info(f"  ↳ Current turn: {current_player} ({player_name})")
                logger.info(f"  ↳ Disconnected: {is_disconnected}")
                logger.info(f"  ↳ Dice duration: {game.dice_duration}s")
                logger.info(f"  ↳ Last roll time: {game.last_roll_time}")

                if game.check_auto_roll_needed():
                    logger.info(f"🎲 AUTO-ROLL TRIGGERED in {game_id} for {player_name}")

                    if is_disconnected:
                        logger.info(f"  ↳ Reason: Player is OFFLINE")
                    else:
                        logger.info(f"  ↳ Reason: Timer expired")

                    result = game.perform_auto_roll()
                    if result:
                        dice_data = result.get('dice', {})
                        logger.info(f"  ↳ Dice result: {dice_data}")

                        await sio.emit('dice_rolled', {
                            'stock': dice_data.get('stock'),
                            'action': dice_data.get('action'),
                            'amount': dice_data.get('amount'),
                            'roll_id': dice_data.get('roll_id'),
                            'auto': True,
                            'player': player_name,
                            'player_disconnected': is_disconnected
                        }, room=game_id)
                        changed = True

                        # Wait for animation
                        await sio.sleep(2)
                    else:
                        logger.error(f"  ↳ FAILED to perform auto-roll!")
                else:
                    logger.info(f"  ↳ No auto-roll needed yet")

            # Broadcast state if changed
            if changed:
                await emit_game_state(game_id)

                # Check for game over
                if game.game_over:
                    logger.info(f"🏁 Game {game_id} ended")
                    await sio.emit('game_over', {
                        'winner': game.winner,
                        'final_rankings': game.get_final_rankings()
                    }, room=game_id)


# Start background monitor
sio.start_background_task(background_game_monitor)

if __name__ == '__main__':
    logger.info("Starting Socket.IO game server on port 9999...")
    web.run_app(app, host='127.0.0.1', port=9999)