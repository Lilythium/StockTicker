import random
import time


class GameState:
    def __init__(self, player_count):
        # STOCKS
        self.stocks = {
            "Gold": 1.00,
            "Silver": 1.00,
            "Oil": 1.00,
            "Bonds": 1.00,
            "Industrials": 1.00,
            "Grain": 1.00
        }

        # NET WORTH TRACKING (for game over graph)
        self.networth_history = {}  # {player_slot: [(round, networth), ...]}

        # PLAYERS
        self.players = {}
        self.player_names = {}  # Active sessions: {player_id: {slot, name}}
        self.player_id_slots = {}  # Persistent mapping: {player_id: slot} - tracks even when disconnected
        self.player_left_flags = {}  # Track which players have left
        self.first_player_id = None
        self.done_trading = set()

        self.player_count = player_count
        self.initialize_players(player_count)

        # PHASE TRACKING
        self.current_phase = "trading"
        self.current_turn = 0  # Which player's turn (0-3)
        self.current_round = 1
        self.max_rounds = 15
        self.phase_start_time = None
        self.trading_duration = 120  # 2 minutes
        self.dice_duration = 15  # 15 seconds per roll

        # GAME STATE
        self.dice_results = None
        self.roll_count = 0  # Counter to ensure each roll is unique
        self.game_status = "waiting"
        self.last_roll_time = None
        self.game_over = False
        self.winner = None

        # HISTORY TRACKING
        self.history = []
        self.max_history = 1000  # Keep last 1000 events

        # DICE CONSTANTS
        self.STOCK_DIE_MAPPING = {
            1: "Gold", 2: "Silver", 3: "Oil",
            4: "Bonds", 5: "Industrials", 6: "Grain"
        }
        self.ACTION_DIE_MAPPING = {
            1: "up", 2: "up", 3: "down",
            4: "down", 5: "div", 6: "div"
        }
        self.AMOUNT_DIE_MAPPING = {
            1: 5, 2: 5, 3: 10,
            4: 10, 5: 20, 6: 20
        }

    def format_money(self, amount):
        """Format money consistently with thousands separator"""
        return f"${amount:,.2f}"

    def add_history_entry(self, entry_type, message):
        """Add an entry to the game history"""
        timestamp = time.time()
        entry = {
            'type': entry_type,
            'message': message,
            'timestamp': timestamp,
            'round': self.current_round,
            'phase': self.current_phase
        }
        self.history.append(entry)

        if len(self.history) > self.max_history:
            self.history = self.history[-self.max_history:]

    def get_player_name(self, slot):
        """Get player name by slot"""
        slot_str = str(slot)
        for info in self.player_names.values():
            if info["slot"] == slot_str:
                return info["name"]

        # Return cached name if player left
        if slot_str in self.players and "name" in self.players[slot_str]:
            return self.players[slot_str]["name"]

        return f"Player {int(slot) + 1}"

    def initialize_players(self, amount):
        """Initialize the player slots"""
        self.players.clear()
        self.player_names.clear()
        self.player_id_slots.clear()
        self.player_left_flags.clear()
        self.first_player_id = None
        self.done_trading.clear()

        base = {
            "cash": 5000.00,
            "portfolio": {
                "Gold": 0, "Silver": 0, "Oil": 0,
                "Bonds": 0, "Industrials": 0, "Grain": 0
            }
        }

        for i in range(amount):
            slot_str = str(i)
            self.players[slot_str] = {
                "name": f"Empty Slot {i + 1}",
                "cash": base["cash"],
                "portfolio": base["portfolio"].copy()
            }
            self.player_left_flags[slot_str] = False
            self.networth_history[slot_str] = []

    def add_player(self, php_player_id, player_name, requested_slot=None):
        """Assigns a PHP client to a slot - handles both new joins and rejoins"""

        # Check if this player is already in the game (active session)
        if php_player_id in self.player_names:
            return {"success": True, "slot": self.player_names[php_player_id]["slot"], "rejoined": False}

        # Check if this player was previously in the game (disconnected)
        if php_player_id in self.player_id_slots:
            return self.reconnect_player(php_player_id, player_name)

        # New player joining
        existing_names = [info["name"] for info in self.player_names.values()]
        original_name = player_name
        counter = 2
        while player_name in existing_names:
            player_name = f"{original_name} ({counter})"
            counter += 1

        taken = {info["slot"] for info in self.player_names.values() if info.get("slot")}
        free = [s for s in self.players.keys() if s not in taken]

        if not free:
            return {"success": False, "error": "Game full"}

        slot = requested_slot if requested_slot in free else free[0]

        if self.first_player_id is None:
            self.first_player_id = php_player_id

        self.player_names[php_player_id] = {
            "slot": slot,
            "name": player_name
        }

        # Track this player_id -> slot mapping persistently
        self.player_id_slots[php_player_id] = slot

        self.players[slot]["name"] = player_name
        self.player_left_flags[slot] = False

        self.add_history_entry('system', f"{player_name} joined the game")

        return {"success": True, "slot": slot, "name": player_name, "player_name": player_name, "rejoined": False}

    def reconnect_player(self, php_player_id, player_name):
        """Reconnect a previously disconnected player to their slot"""
        slot = self.player_id_slots[php_player_id]
        original_name = self.players[slot]["name"]

        # Restore active session
        self.player_names[php_player_id] = {
            "slot": slot,
            "name": original_name
        }

        # Clear disconnected flag
        self.player_left_flags[slot] = False

        # Remove from done_trading if they were auto-marked
        self.done_trading.discard(slot)

        # Reassign host if needed and game is waiting
        if self.first_player_id is None and self.game_status == "waiting":
            self.first_player_id = php_player_id

        self.add_history_entry('system', f"{original_name} reconnected")

        return {
            "success": True,
            "slot": slot,
            "name": original_name,
            "player_name": original_name,
            "rejoined": True,
            "message": f"Welcome back, {original_name}!"
        }

    def reassign_host(self):
        """Reassign host to the next available connected player"""
        if not self.player_names:
            # No players left
            self.first_player_id = None
            return None

        # Get list of connected player IDs sorted by join order
        # The first one in player_names will be the new host
        new_host_id = next(iter(self.player_names))
        self.first_player_id = new_host_id

        new_host_name = self.player_names[new_host_id]["name"]
        self.add_history_entry('system', f"{new_host_name} is now the host")

        return new_host_id

    def remove_player(self, php_player_id):
        """Remove a player's session but keep them in game as disconnected"""
        if php_player_id not in self.player_names:
            return {"success": False, "error": "Player not in game"}

        player_info = self.player_names[php_player_id]
        player_name = player_info["name"]
        player_slot = player_info["slot"]
        was_host = (php_player_id == self.first_player_id)

        # Mark player as disconnected
        self.player_left_flags[player_slot] = True

        # Keep name in player data for history
        self.players[player_slot]["name"] = player_name

        # Keep player_id -> slot mapping so they can rejoin
        # (already in self.player_id_slots, so no need to add again)

        # Remove from active sessions
        del self.player_names[php_player_id]

        self.add_history_entry('system', f"{player_name} disconnected")

        # Reassign host if the host left
        if was_host:
            self.reassign_host()

        # During active game, ignore their done_trading vote
        # Don't auto-mark them as done anymore
        if self.current_phase == "trading":
            self.done_trading.discard(player_slot)

        # Check active players (those still connected)
        active_sessions = len(self.player_names)

        # Only end game if ALL players disconnect
        if self.game_status == "active" and active_sessions == 0:
            self.add_history_entry('system', "All players disconnected. Game ending...")
            self.end_game()
            return {
                "success": True,
                "message": "All players left. Game over!",
                "game_over": True
            }

        return {
            "success": True,
            "message": f"{player_name} disconnected. They can rejoin anytime.",
            "new_host": self.first_player_id if was_host else None
        }

    def get_active_slots(self):
        """Get list of player slots that are IN THE GAME (not empty)"""
        active = []
        for slot in self.players.keys():
            # Slot is active if it was ever filled (has a real name)
            if self.players[slot]["name"] and not self.players[slot]["name"].startswith("Empty Slot"):
                active.append(int(slot))
        return sorted(active)

    def get_connected_slots(self):
        """Get list of player slots with active sessions"""
        return sorted([int(info["slot"]) for info in self.player_names.values()])

    def start_game(self, settings=None):
        """Start the game - transition from waiting to active"""
        active = len([s for s in self.get_active_slots()])
        if active < 2:
            return {"success": False, "message": "Need at least 2 players"}

        if settings:
            self.max_rounds = int(settings.get('max_rounds', 15))
            self.trading_duration = int(settings.get('trading_duration', 2)) * 60
            self.dice_duration = int(settings.get('dice_duration', 15))
            self.set_starting_cash(int(settings.get('starting_cash', 5000)))

        self.game_status = "active"
        self.current_phase = "trading"
        self.current_round = 1
        self.done_trading.clear()
        self.phase_start_time = time.time()

        active_slots = self.get_active_slots()
        self.current_turn = active_slots[0]

        self.record_networth_snapshot()
        self.add_history_entry('phase', f"Game started - Trading Phase Round 1")

        return {"success": True}

    def set_starting_cash(self, starting_cash):
        for player_data in self.players.values():
            player_data['cash'] = starting_cash

    def record_networth_snapshot(self):
        """Record current net worth for all active players"""
        for slot in self.get_active_slots():
            slot_str = str(slot)
            networth = self.get_networth(slot_str)
            self.networth_history[slot_str].append((self.current_round, networth))

    def mark_done_trading(self, player_slot):
        """Mark player as done trading"""
        slot_str = str(player_slot)

        # Ignore if player is disconnected
        if self.player_left_flags.get(slot_str, False):
            return {"success": False, "error": "Player is disconnected"}

        self.done_trading.add(slot_str)

        player_name = self.get_player_name(player_slot)
        self.add_history_entry('trade', f"{player_name} marked done trading")

        return {"success": True, "done_count": len(self.done_trading)}

    def check_trading_phase_complete(self):
        """Check if trading phase should end"""
        active_slots = set(str(s) for s in self.get_active_slots())

        # Get connected slots (exclude disconnected players from vote count)
        connected_slots = set(str(s) for s in self.get_connected_slots())

        # Condition 1: All CONNECTED players marked done (disconnected players don't vote)
        if len(connected_slots) >= 1 and connected_slots.issubset(self.done_trading):
            return True

        # Condition 2: Timer expired
        if self.phase_start_time:
            elapsed = time.time() - self.phase_start_time
            if elapsed >= self.trading_duration:
                # Auto-mark all connected players as done
                for slot in connected_slots:
                    self.done_trading.add(slot)
                return True

        return False

    def check_auto_roll_needed(self):
        """Check if current player's turn has expired or they've disconnected"""
        if self.current_phase != "dice":
            return False

        # Get current turn as string for dictionary lookup
        current_turn_str = str(self.current_turn)

        # Debug info
        print(f"DEBUG check_auto_roll_needed:")
        print(f"  ↳ Current turn: {self.current_turn} ({current_turn_str})")
        print(f"  ↳ Player left flags: {self.player_left_flags}")
        print(f"  ↳ Current player in flags: {self.player_left_flags.get(current_turn_str, 'NOT FOUND')}")

        # Auto-roll if current player disconnected
        if self.player_left_flags.get(current_turn_str, False):
            print(f"  ↳ Player is disconnected - auto-roll needed")
            return True

        # Auto-roll if dice timer is 0 (instant mode)
        if self.dice_duration == 0:
            print(f"  ↳ Dice duration is 0 - auto-roll needed")
            return True

        # Auto-roll if time expired
        if self.last_roll_time:
            elapsed = time.time() - self.last_roll_time
            print(f"  ↳ Elapsed time: {elapsed}s, Duration: {self.dice_duration}s")
            if elapsed >= self.dice_duration:
                print(f"  ↳ Time expired - auto-roll needed")
                return True

        print(f"  ↳ No auto-roll needed")
        return False

    def perform_auto_roll(self):
        """Explicitly perform an auto-roll and return result"""
        if self.current_phase != "dice":
            print(f"DEBUG: Not in dice phase, cannot auto-roll")
            return None

        current_turn_str = str(self.current_turn)
        player_name = self.get_player_name(self.current_turn)
        is_disconnected = self.player_left_flags.get(current_turn_str, False)

        print(f"DEBUG perform_auto_roll:")
        print(f"  ↳ Player: {player_name} (slot {self.current_turn})")
        print(f"  ↳ Disconnected: {is_disconnected}")

        # Add context to history about why this is auto-rolling
        if is_disconnected:
            self.add_history_entry('system', f"{player_name} (disconnected) - auto-rolling...")
        else:
            self.add_history_entry('system', f"{player_name} - dice timer expired, auto-rolling...")

        # Perform the roll - pass None to indicate system roll
        try:
            result = self.roll_dice(player_slot=None)  # System call

            if result and result.get('success'):
                print(f"  ↳ Auto-roll successful: {result.get('dice')}")
                return result
            else:
                print(f"  ↳ Auto-roll failed: {result}")

                # Fallback: Force a roll
                print(f"  ↳ Using fallback roll")
                return self._force_dice_roll()
        except Exception as e:
            print(f"  ↳ Exception in auto-roll: {e}")
            import traceback
            traceback.print_exc()
            return self._force_dice_roll()

    def _force_dice_roll(self):
        """Force a dice roll as fallback"""
        stock_die = random.randint(1, 6)
        action_die = random.randint(1, 6)
        amount_die = random.randint(1, 6)

        stock = self.STOCK_DIE_MAPPING[stock_die]
        action = self.ACTION_DIE_MAPPING[action_die]
        amount = self.AMOUNT_DIE_MAPPING[amount_die]

        self.roll_count += 1
        self.dice_results = {
            "stock": stock,
            "action": action,
            "amount": amount,
            "roll_id": self.roll_count,
            "timestamp": time.time()
        }

        # Apply the roll
        result_message = self.handle_dice_roll(stock, action, amount)

        # Advance turn
        self.advance_dice_turn()

        return {
            "success": True,
            "dice": {
                "stock": stock,
                "action": action,
                "amount": amount,
                "roll_id": self.roll_count
            },
            "result": result_message,
            "auto": True
        }

    def change_game_phase(self):
        """Transition between trading and dice phases"""
        if self.current_phase == "trading":
            self.current_phase = "dice"
            active_slots = self.get_active_slots()
            self.current_turn = active_slots[0] if active_slots else 0
            self.last_roll_time = time.time()

            self.add_history_entry('phase', f"▶ Phase changed to Dice Phase")

            player_name = self.get_player_name(self.current_turn)
            self.add_history_entry('roll', f"{player_name}'s turn to roll")

        else:
            self.record_networth_snapshot()
            self.current_phase = "trading"
            self.current_round += 1
            self.done_trading.clear()  # CLEAR done_trading flags
            self.phase_start_time = time.time()

            if self.current_round > self.max_rounds:
                self.end_game()
            else:
                self.add_history_entry('phase', f"▶ Round {self.current_round} started - Trading Phase")

        return {"success": True, "new_phase": self.current_phase}

    def end_game(self):
        """End the game and determine winner"""
        self.current_phase = "game_over"
        self.game_over = True
        self.game_status = "finished"

        active_slots = [str(s) for s in self.get_active_slots()]

        if not active_slots:
            self.add_history_entry('phase', "Game Over! No players.")
            return

        # Determine winner (highest net worth)
        winner_slot = max(active_slots, key=lambda s: self.get_networth(s))
        winner_name = self.get_player_name(winner_slot)
        winner_networth = self.get_networth(winner_slot)

        self.winner = {
            "slot": winner_slot,
            "name": winner_name,
            "networth": winner_networth
        }

        self.add_history_entry('phase', f"🏆 Game Over! {winner_name} wins with {self.format_money(winner_networth)}!")

    def advance_dice_turn(self):
        """Move to next player's turn in dice phase"""
        active_slots = self.get_active_slots()

        try:
            current_idx = active_slots.index(self.current_turn)

            if current_idx + 1 < len(active_slots):
                # Clear dice results before switching to next player
                self.dice_results = None

                self.current_turn = active_slots[current_idx + 1]
                self.last_roll_time = time.time()

                player_name = self.get_player_name(self.current_turn)
                self.add_history_entry('roll', f"{player_name}'s turn to roll")

                return {"next_player": self.current_turn}
            else:
                self.change_game_phase()
                return {"phase_complete": True}
        except ValueError:
            self.current_turn = active_slots[0] if active_slots else 0
            return {"reset_turn": True}

    def roll_dice(self, player_slot=None):
        """Roll dice and apply results"""
        if self.current_phase != "dice":
            return {"success": False, "error": "Not dice phase"}

        # Check if player is disconnected
        player_disconnected = self.player_left_flags.get(str(self.current_turn), False)

        # Allow auto-rolls for disconnected players OR when called without player_slot (system roll)
        # Also allow if dice duration is 0 (instant rolls)
        instant_roll = self.dice_duration == 0
        is_system_call = (player_slot is None)  # Called by perform_auto_roll()

        # Allow the roll if:
        # 1. Player is making their own roll (normal case)
        # 2. Player is disconnected and system is rolling for them (auto-roll)
        # 3. It's a system call (perform_auto_roll)
        # 4. Instant roll mode is enabled
        if (player_slot is not None and
                str(player_slot) != str(self.current_turn) and
                not player_disconnected and
                not is_system_call and
                not instant_roll):
            return {"success": False, "error": "Not your turn"}

        stock_die = random.randint(1, 6)
        action_die = random.randint(1, 6)
        amount_die = random.randint(1, 6)

        stock = self.STOCK_DIE_MAPPING[stock_die]
        action = self.ACTION_DIE_MAPPING[action_die]
        amount = self.AMOUNT_DIE_MAPPING[amount_die]

        # Increment roll counter to make each roll unique
        self.roll_count += 1
        self.dice_results = {
            "stock": stock,
            "action": action,
            "amount": amount,
            "roll_id": self.roll_count,
            "timestamp": time.time()
        }

        result = self.handle_dice_roll(stock, action, amount)

        player_name = self.get_player_name(self.current_turn)
        is_disconnected = self.player_left_flags.get(str(self.current_turn), False)

        # Create history message
        if is_disconnected:
            history_msg = f"🤖 {player_name} (offline) rolled: "
        else:
            history_msg = f"🎲 {player_name} rolled: "

        if action == 'div':
            if self.stocks[stock] <= 1.00:
                history_msg += f"{stock} dividend - dividends not payable."
            else:
                owners = []
                for slot in self.get_active_slots():
                    slot_str = str(slot)
                    if self.players[slot_str]['portfolio'][stock] > 0:
                        owners.append(self.get_player_name(slot))

                if owners:
                    owners_list = ", ".join(owners)
                    history_msg += f"{stock} paid ${amount / 100:.2f} dividend per share - dividends paid to: {owners_list}"
                else:
                    history_msg += f"{stock} dividend - Nobody owns {stock}."
        elif action == 'up':
            history_msg += f"{stock} moved UP {amount}¢"
        else:
            history_msg += f"{stock} moved DOWN {amount}¢"

        self.add_history_entry('roll', history_msg)

        advance_result = self.advance_dice_turn()

        return {
            "success": True,
            "dice": {"stock": stock, "action": action, "amount": amount, "roll_id": self.roll_count},
            "result": result,
            "advance": advance_result,
            "auto": player_disconnected or is_system_call
        }

    def handle_dice_roll(self, stock, action, amount):
        """Apply dice roll effects to game state"""
        if action == "div":
            # Check if stock price is above $1.00 before paying dividends
            if self.stocks[stock] <= 1.00:
                return f'{stock} dividend not payable (price at or below $1.00)'

            # Pay dividends only if stock price > $1.00
            dividend_paid = False
            for slot in self.get_active_slots():
                slot_str = str(slot)
                shares = self.players[slot_str]['portfolio'][stock]
                if shares > 0:
                    dividend = shares * (amount / 100)
                    self.players[slot_str]['cash'] += dividend
                    dividend_paid = True

            if not dividend_paid:
                return f'{stock} dividend declared but nobody owns shares'

            return f'{stock} paid ${amount / 100:.2f} dividend per share'

        change = amount if action == "up" else -amount
        self.move_stock(stock, change)

        direction = "up" if action == "up" else "down"
        return f'{stock} moved {direction} {amount}¢ to ${self.stocks[stock]:.2f}'

    def move_stock(self, target, cents):
        """Move stock price and handle splits/bankruptcies"""
        self.stocks[target] += cents / 100

        if self.stocks[target] >= 2.00:
            for slot in self.get_active_slots():
                slot_str = str(slot)
                self.players[slot_str]["portfolio"][target] *= 2
            self.stocks[target] = 1.00
            self.add_history_entry('system', f"📈 {target} SPLIT! All shares doubled, price reset to $1.00")

        if self.stocks[target] <= 0:
            for slot in self.get_active_slots():
                slot_str = str(slot)
                self.players[slot_str]["portfolio"][target] = 0
            self.stocks[target] = 1.00
            self.add_history_entry('system', f"💥 {target} went BANKRUPT! All shares lost, price reset to $1.00")

    def get_networth(self, slot):
        """Calculate player's total net worth"""
        total = self.players[slot]["cash"]
        for s, qty in self.players[slot]["portfolio"].items():
            total += qty * self.stocks[s]
        return total

    def get_time_remaining(self):
        """Get time remaining in current phase"""
        if not self.phase_start_time and not self.last_roll_time:
            return 0

        if self.current_phase == "trading":
            if not self.phase_start_time:
                return 0
            elapsed = time.time() - self.phase_start_time
            remaining = self.trading_duration - elapsed
        else:
            if self.last_roll_time:
                elapsed = time.time() - self.last_roll_time
                remaining = self.dice_duration - elapsed
            else:
                remaining = self.dice_duration

        return max(0, remaining)

    def get_final_rankings(self):
        """Get sorted list of players by net worth for game over screen"""
        rankings = []
        for slot in self.get_active_slots():
            slot_str = str(slot)
            data = self.players[slot_str]

            # Try to find player_id
            pid = None
            for php_id, info in self.player_names.items():
                if info["slot"] == slot_str:
                    pid = php_id
                    break

            # If not in active sessions, check persistent mapping
            if pid is None:
                for php_id, mapped_slot in self.player_id_slots.items():
                    if mapped_slot == slot_str:
                        pid = php_id
                        break

            rankings.append({
                "slot": slot_str,
                "player_id": pid,
                "name": data["name"],
                "net_worth": self.get_networth(slot_str),
                "cash": data["cash"],
                "portfolio": data["portfolio"].copy(),
                "was_disconnected": self.player_left_flags.get(slot_str, False)
            })

        rankings.sort(key=lambda x: x["net_worth"], reverse=True)
        return rankings

    def get_game_state(self):
        """Return complete game state"""
        players = {}

        for slot, data in self.players.items():
            pid = None
            name = data["name"]
            is_connected = False

            for php_id, info in self.player_names.items():
                if info["slot"] == slot:
                    pid = php_id
                    is_connected = True
                    break

            # If not connected, try to find in persistent mapping
            if pid is None:
                for php_id, mapped_slot in self.player_id_slots.items():
                    if mapped_slot == slot:
                        pid = php_id
                        break

            is_active = not data["name"].startswith("Empty Slot")

            players[slot] = {
                "cash": data["cash"],
                "portfolio": data["portfolio"].copy(),
                "net_worth": self.get_networth(slot) if is_active else 0,
                "player_id": pid,
                "name": name,
                "is_active": is_active,
                "is_connected": is_connected,
                "done_trading": slot in self.done_trading,
                "has_left": self.player_left_flags.get(slot, False)
            }

        return {
            "stocks": self.stocks.copy(),
            "players": players,
            "current_phase": self.current_phase,
            "current_turn": self.current_turn,
            "current_round": self.current_round,
            "max_rounds": self.max_rounds,
            "status": self.game_status,
            "phase_start_time": self.phase_start_time,
            "time_remaining": self.get_time_remaining(),
            "trading_duration": self.trading_duration,
            "dice_duration": self.dice_duration,
            "done_trading_count": len(self.done_trading),
            "active_player_count": len(self.get_active_slots()),
            "connected_player_count": len(self.get_connected_slots()),
            "dice_results": self.dice_results,
            "trading_complete": self.check_trading_phase_complete(),
            "auto_roll_needed": self.check_auto_roll_needed(),
            "history": self.history,
            "game_over": self.game_over,
            "winner": self.winner,
            "networth_history": self.networth_history,
            "final_rankings": self.get_final_rankings() if self.game_over else [],
            "player_count": self.player_count,
            "host_player_id": self.first_player_id
        }

    def buy_shares(self, player, stock, amount):
        """Buy shares of a stock"""
        player = str(player)
        if player not in self.players:
            return {'success': False, 'error': 'Invalid player slot'}
        if stock not in self.stocks:
            return {'success': False, 'error': 'Invalid stock'}

        player_data = self.players[player]
        total_cost = amount * self.stocks[stock]

        if player_data['cash'] < total_cost:
            return {'success': False, 'error': 'Not enough cash'}

        player_data['cash'] -= total_cost
        player_data['portfolio'][stock] += amount

        player_name = self.get_player_name(player)
        self.add_history_entry('trade', f"{player_name} bought {amount} {stock}")

        return {'success': True, 'data': f'Bought {amount} shares of {stock}'}

    def sell_shares(self, player, stock, amount):
        """Sell shares of a stock"""
        player = str(player)
        if player not in self.players:
            return {'success': False, 'error': 'Invalid player slot'}
        if stock not in self.stocks:
            return {'success': False, 'error': 'Invalid stock'}

        player_data = self.players[player]
        if player_data['portfolio'][stock] < amount:
            return {'success': False, 'error': 'Not enough shares'}

        player_data['portfolio'][stock] -= amount
        player_data['cash'] += amount * self.stocks[stock]

        player_name = self.get_player_name(player)
        self.add_history_entry('trade', f"{player_name} sold {amount} {stock}")

        return {'success': True, 'data': f'Sold {amount} shares of {stock}'}