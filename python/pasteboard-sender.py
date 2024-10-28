import asyncio
import socketio
import pyperclip
import random
from aiortc import RTCPeerConnection, RTCSessionDescription, RTCIceCandidate

sio = socketio.AsyncClient()
WEBSOCKET_URL = "ws://localhost:3000"
BASE_URL = "http://localhost:3000/sender"


# Generate a 3-word session ID
def generate_session_id():
    adjectives = ["quick", "lazy", "sleepy", "noisy", "hungry"]
    nouns = ["fox", "dog", "lion", "cat", "bird"]
    return f"{random.choice(adjectives)}-{random.choice(adjectives)}-{random.choice(nouns)}"


session_id = generate_session_id()
peer_connections = {}
data_channels = {}

print(f"Generated Session ID: {session_id}")
print(f"Open this URL to connect: {BASE_URL}?sessionId={session_id}")


# Connect to the WebSocket server
@sio.event
async def connect():
    print("Connected to WebSocket server.")
    await sio.emit("joinSession", session_id)


# Peer joined: Create an offer and handle signaling
@sio.on("peerJoined")
async def on_peer_joined(data):
    peer_id = data.get("peerId")
    print(f"New peer joined: {peer_id}")

    peer_connection = RTCPeerConnection()
    peer_connections[peer_id] = peer_connection

    # Create data channel for messaging
    data_channel = peer_connection.createDataChannel("messaging")
    data_channels[peer_id] = data_channel
    data_channel.onopen = lambda: print(f"Data channel open with {peer_id}")
    data_channel.onmessage = lambda event: print(
        f"Message from {peer_id}: {event.data}"
    )

    # Handle ICE candidates
    @peer_connection.on("icecandidate")
    async def on_icecandidate(event):
        if event.candidate:
            await sio.emit(
                "signal",
                {
                    "sessionId": session_id,
                    "peerId": peer_id,
                    "data": {
                        "type": "ice-candidate",
                        "candidate": event.candidate.to_dict(),
                    },
                },
            )

    # Send an offer
    offer = await peer_connection.createOffer()
    await peer_connection.setLocalDescription(offer)
    await sio.emit(
        "signal",
        {
            "sessionId": session_id,
            "peerId": peer_id,
            "data": {"type": "offer", "sdp": offer.sdp, "type": offer.type},
        },
    )


# Handle incoming signaling messages
@sio.on("signal")
async def on_signal(data):
    peer_id = data["peerId"]
    signal_data = data["data"]
    peer_connection = peer_connections.get(peer_id)

    if not peer_connection:
        print(f"No peer connection found for {peer_id}")
        return

    if signal_data["type"] == "offer":
        await peer_connection.setRemoteDescription(
            RTCSessionDescription(signal_data["sdp"], signal_data["type"])
        )
        answer = await peer_connection.createAnswer()
        await peer_connection.setLocalDescription(answer)
        await sio.emit(
            "signal",
            {
                "sessionId": session_id,
                "peerId": peer_id,
                "data": {"type": "answer", "sdp": answer.sdp, "type": answer.type},
            },
        )
    elif signal_data["type"] == "answer":
        await peer_connection.setRemoteDescription(
            RTCSessionDescription(signal_data["sdp"], signal_data["type"])
        )
    elif signal_data["type"] == "ice-candidate":
        candidate = RTCIceCandidate(
            sdpMid=signal_data["candidate"]["sdpMid"],
            sdpMLineIndex=signal_data["candidate"]["sdpMLineIndex"],
            candidate=signal_data["candidate"]["candidate"],
        )
        await peer_connection.addIceCandidate(candidate)


# Clipboard monitoring and sending messages
async def clipboard_monitor():
    last_clipboard_content = ""
    while True:
        clipboard_content = pyperclip.paste()
        if clipboard_content != last_clipboard_content and clipboard_content.strip():
            last_clipboard_content = clipboard_content
            send_text_to_display(clipboard_content)
        await asyncio.sleep(1)


# Send text messages over data channels
def send_text_to_display(text):
    for peer_id, data_channel in data_channels.items():
        if data_channel.readyState == "open":
            data_channel.send(text)
        else:
            print(f"Data channel not open for {peer_id}")


async def main():
    await sio.connect(WEBSOCKET_URL, transports=["websocket"])
    await clipboard_monitor()


if __name__ == "__main__":
    asyncio.run(main())
