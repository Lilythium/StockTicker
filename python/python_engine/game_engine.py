import json
import socket
import logging
import traceback
from game_state import GameState

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class GameEngine:
    def __init__(self):
        self.games = {}

    def get_game(self, game_id, player_count=4):
        if game_id not in self.games:
            self.games[game_id] = GameState(player_count)
        return self.games[game_id]

    def handle_command(self, game_id, action, params):
        if not isinstance(params, dict):
            params = {}

        game = self.get_game(game_id, params.get("player_count", 4))

        try:
            # Get game state - with auto-actions
            if action == "get_game_state":
                # Auto-transition trading phase if complete
                if game.current_phase == "trading" and game.check_trading_phase_complete():
                    game.change_game_phase()

                # Auto-roll if needed (player disconnected or timer expired)
                if game.current_phase == "dice" and game.check_auto_roll_needed():
                    logger.info(f"Auto-roll triggered for game {game_id}, turn {game.current_turn}")
                    auto_roll_result = game.perform_auto_roll()
                    if auto_roll_result:
                        logger.info(f"Auto-roll completed: {auto_roll_result.get('dice', {})}")

                return {"success": True, "data": game.get_game_state()}

            # Initialize game (create with first player)
            if action == "initialize_game":
                result = game.add_player(
                    params["player_id"],
                    params["player_name"]
                )
                return {"success": True, "data": result}

            # Join existing game
            if action == "join_game":
                result = game.add_player(
                    params["player_id"],
                    params["player_name"]
                )
                return {"success": True, "data": result}

            # Leave game
            if action == "leave_game":
                result = game.remove_player(params["player_id"])
                return {"success": True, "data": result}

            # Start the game
            if action == "start_game":
                settings = params.get('settings', {})
                result = game.start_game(settings)
                return {"success": True, "data": result}

            # Buy shares
            if action == "buy_shares":
                return {"success": True, "data": game.buy_shares(
                    params["player"], params["stock"], params["amount"]
                )}

            # Sell shares
            if action == "sell_shares":
                return {"success": True, "data": game.sell_shares(
                    params["player"], params["stock"], params["amount"]
                )}

            # Mark done trading
            if action == "done_trading":
                result = game.mark_done_trading(params["player"])

                # Check if all players are done
                if game.check_trading_phase_complete():
                    game.change_game_phase()

                return {"success": True, "data": result}

            # Roll dice (applies results automatically)
            if action == "roll_dice":
                player_slot = params.get("player")
                result = game.roll_dice(player_slot)
                return {"success": True, "data": result}

            # Manual phase change (for testing/admin)
            if action == "change_game_phase":
                return {"success": True, "data": game.change_game_phase()}

            return {"success": False, "error": "Unknown action"}

        except (KeyError, ValueError, TypeError) as e:
            logger.error(f"Invalid parameters for {action}: {str(e)}")
            return {"success": False, "error": f"Invalid parameters: {str(e)}"}
        except Exception as e:  # pylint: disable=broad-except
            # Broad exception is intentional here - we want to catch any game logic errors
            logger.error(f"Error handling {action}: {traceback.format_exc()}")
            return {"success": False, "error": str(e)}

    def process(self, raw):
        """Process incoming request and return response"""
        try:
            req = json.loads(raw)
            resp = self.handle_command(
                req["game_id"],
                req["action"],
                req.get("params", {})
            )
            resp["game_id"] = req["game_id"]
            return json.dumps(resp)
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON received: {str(e)}")
            return json.dumps({
                "success": False,
                "error": f"Invalid JSON: {str(e)}"
            })
        except KeyError as e:
            logger.error(f"Missing required field: {str(e)}")
            return json.dumps({
                "success": False,
                "error": f"Missing required field: {str(e)}"
            })
        except Exception as e:  # pylint: disable=broad-except
            # Broad exception is intentional - catch any unexpected errors during processing
            logger.error(f"Process error: {traceback.format_exc()}")
            return json.dumps({
                "success": False,
                "error": f"Server error: {str(e)}"
            })

    def start(self, host="127.0.0.1", port=5000):
        """Start the game engine server"""
        sock = socket.socket()
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind((host, port))
        sock.listen()
        logger.info(f"Game engine running on {host}:{port}")

        while True:
            conn = None
            try:
                conn, addr = sock.accept()
                logger.info(f"Connection from {addr}")

                data = conn.recv(4096).decode('utf-8')
                if data:
                    logger.info(f"Received: {data[:100]}...")
                    response = self.process(data)
                    logger.info(f"Sending: {response[:100]}...")
                    conn.sendall(response.encode('utf-8'))

                conn.close()
            except Exception as e:
                logger.error(f"Connection error: {traceback.format_exc()}")
                if conn:
                    try:
                        conn.close()
                    except socket.error:
                        pass


if __name__ == "__main__":
    GameEngine().start(port=9999)
