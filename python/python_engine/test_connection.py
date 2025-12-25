import socket

HOST = '127.0.0.1'  # Engine host
PORT = 9999  # Engine port (match your GameClient)
TIMEOUT = 5  # seconds

try:
    with socket.create_connection((HOST, PORT), timeout=TIMEOUT) as sock:
        print(f"Connected to {HOST}:{PORT}")

        # Example: send a simple command (replace with whatever your engine expects)
        message = "HELLO_ENGINE\n"
        sock.sendall(message.encode('utf-8'))

        # Receive response (adjust buffer size if needed)
        data = sock.recv(1024)
        print("Received:", data.decode('utf-8'))

except ConnectionRefusedError:
    print("Could not connect. Is the engine running?")
except socket.timeout:
    print("Connection timed out.")
except Exception as e:
    print("Error:", e)
