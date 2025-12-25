import os

# Ensure logs directory exists
LOG_DIR = 'logs'
LOG_FILE = os.path.join(LOG_DIR, 'engine.log')

# Create directory if it doesn't exist
os.makedirs(LOG_DIR, exist_ok=True)

# Your existing configuration
SOCKET_HOST = '127.0.0.1'
SOCKET_PORT = 9999
MAX_CONNECTIONS = 10
SOCKET_TIMEOUT = 30
DATA_DIR = '../game-data/games/'
MAX_PLAYERS = 4
GAME_TIMEOUT_HOURS = 24
LOG_LEVEL = 'INFO'
LOG_FORMAT = '%(asctime)s - %(levelname)s - %(message)s'
STATE_CACHE_SIZE = 50
AUTO_SAVE_INTERVAL = 5
