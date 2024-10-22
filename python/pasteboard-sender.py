import time
import pyperclip  # To read clipboard data
import socketio
import logging

logging.basicConfig(level=logging.DEBUG)
sio = socketio.Client(logger=True, engineio_logger=True)

# Define the WebSocket URL (replace with your actual URL)
WEBSOCKET_URL = "wss://owd.acecentre.net"

# Initialize socket.io client
sio = socketio.Client()

# Store session ID
session_id = None


# Connect to WebSocket server
@sio.event
def connect():
    print("Connected to WebSocket server.")
    sio.emit("joinSession", session_id)


# Handle receiving a signal from the display app
@sio.event
def signal(data):
    print(f"Signal received: {data}")


# Handle disconnect
@sio.event
def disconnect():
    print("Disconnected from WebSocket server.")


def send_text_to_display(text):
    print(f"send_text_to_display called with text: {text}")
    if session_id:
        message = {
            "sessionId": session_id,
            "data": {"type": "message", "content": text},
        }
        print(f"Sending message: {message}")
        sio.emit("signal", message)
    else:
        print("Session ID is not set. Cannot send message.")


def main():
    global session_id

    # Ask the user to input the 3-word session ID
    session_id = input("Enter the 3-word session ID: ")

    # Connect to the WebSocket server
    sio.connect(WEBSOCKET_URL)

    # Loop to monitor clipboard changes
    last_clipboard_content = ""
    try:
        while True:
            clipboard_content = pyperclip.paste()

            # If clipboard content changes and it's not empty, send it
            if (
                clipboard_content != last_clipboard_content
                and clipboard_content.strip()
            ):
                last_clipboard_content = clipboard_content
                send_text_to_display(clipboard_content)

            # Check for updates every second
            time.sleep(1)

    except KeyboardInterrupt:
        print("Program interrupted. Disconnecting...")
    finally:
        sio.disconnect()


if __name__ == "__main__":
    main()
