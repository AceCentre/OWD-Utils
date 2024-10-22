import socketio
import time
import sys

# Define WebSocket URL
WEBSOCKET_URL = "wss://owd.acecentre.net"  # Replace with your actual WebSocket URL

# Initialize socket.io client
sio = socketio.Client()

# Store session ID and WebRTCService-like connection flag
session_id = None
is_connected = False


# Connect to WebSocket server
@sio.event
def connect():
    global is_connected
    print(f"Connected to WebSocket server, joining session: {session_id}")
    sio.emit("joinSession", session_id)
    is_connected = True


# Handle disconnect
@sio.event
def disconnect():
    global is_connected
    print("Disconnected from WebSocket server.")
    is_connected = False


# Handle receiving a signal from the display app (can be extended as needed)
@sio.event
def signal(data):
    print(f"Signal received: {data}")


# Send a message to the WebSocket server
def send_message(message):
    if is_connected and session_id:
        print(f"Sending message: {message}")
        sio.emit(
            "signal",
            {"sessionId": session_id, "data": {"type": "message", "content": message}},
        )
    else:
        print("Cannot send message. Not connected or no session ID.")


# Main application flow
def main():
    global session_id

    # Input for session ID
    session_id = input("Enter the 3-word session ID: ")

    try:
        # Connect to WebSocket server
        sio.connect(WEBSOCKET_URL)

        # Main loop to send messages (mimics typing and sending messages)
        while True:
            # Get message input from the command line
            message = input("Type a message to send: ")

            if message.strip():
                send_message(message)
            else:
                print("Message is empty, not sending.")

            # Optionally, simulate typing status
            sio.emit(
                "signal",
                {
                    "sessionId": session_id,
                    "data": {"type": "typing", "content": "Writing..."},
                },
            )

            # Pause for a second to mimic delay
            time.sleep(1)

    except KeyboardInterrupt:
        print("Program interrupted. Disconnecting...")
    finally:
        sio.disconnect()


if __name__ == "__main__":
    main()
