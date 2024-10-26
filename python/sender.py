import time
import json
import socketio
from faker import Faker

# Initialize Faker and generate a unique session ID
fake = Faker()
session_id = f"{fake.word()}-{fake.word()}-{fake.word()}"
print(f"Generated Session ID: {session_id}")

# WebSocket URL (replace with your actual URL)
WEBSOCKET_URL = "ws://localhost:3000"  # replace with your WebSocket URL
sio = socketio.Client(logger=True, engineio_logger=True)

is_connected = False
is_live_typing = False


# Connect to the WebSocket server and join session
@sio.event
def connect():
    global is_connected
    print("Connected to WebSocket server.")
    sio.emit("joinSession", session_id)
    is_connected = True


# Handle disconnect
@sio.event
def disconnect():
    global is_connected
    print("Disconnected from WebSocket server.")
    is_connected = False


# Signal handler
@sio.on("signal")
def on_signal(data):
    message_type = data.get("type")
    content = data.get("content")

    if message_type == "channelConnected":
        print("Display connected.")
    elif message_type == "typing":
        print("Display: Typing...")
    elif message_type == "message":
        print(f"Display: {content}")


# Send connection notification to Display
def notify_connected():
    message = json.dumps(
        {
            "type": "channelConnected",
        }
    )
    sio.emit("signal", {"sessionId": session_id, "data": message})


# Handle live typing messages
def handle_typing():
    global is_live_typing
    print("\nEnable live typing? (y/n): ")
    is_live_typing = input().lower() == "y"
    if is_live_typing:
        print("Live typing is enabled.")


# Send a message to the display
def send_message(message):
    message_data = {
        "type": "message" if not is_live_typing else "typing",
        "content": message,
        "isLiveTyping": is_live_typing,
    }
    sio.emit("signal", {"sessionId": session_id, "data": json.dumps(message_data)})


# Main app loop
def main():
    global is_connected

    # Connect to the WebSocket server
    sio.connect(WEBSOCKET_URL, transports=["websocket"])
    notify_connected()  # Notify the display that the connection was established

    # Enable live typing option
    handle_typing()

    # Main message loop
    try:
        while True:
            if not is_connected:
                print("Waiting for connection...")
                time.sleep(1)
                continue

            # Get user input
            message = input("Enter message (or type 'exit' to quit): ")
            if message.lower() == "exit":
                break

            # Send message or typing indicator
            if is_live_typing:
                for char in message:
                    send_message(char)
                    time.sleep(0.1)  # Simulate typing delay
            else:
                send_message(message)

    except KeyboardInterrupt:
        print("Exiting...")

    finally:
        sio.disconnect()


# Run the app
if __name__ == "__main__":
    main()
