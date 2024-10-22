const io = require("socket.io-client");
const readline = require("readline");

const websocketURL = "wss://owd.acecentre.net";
let sessionId = "";
let webrtcService = null;
let isConnected = false;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// WebRTCService class to handle signaling and message sending
class WebRTCService {
    constructor(onMessageReceived, isSender = true) {
        this.socket = null;
        this.onMessageReceived = onMessageReceived;
        this.isSender = isSender;
        this.isConnected = false;
    }

    connect(websocketURL, sessionId) {
        this.sessionId = sessionId;
        this.socket = io(websocketURL, {
            transports: ['websocket'],
            withCredentials: true
        });

        this.socket.emit("joinSession", this.sessionId);

        this.socket.on("signal", async (message) => {
            if (this.isSender) {
                if (message.type === "answer") {
                    console.log("Received answer signal:", message.answer);
                    this.isConnected = true;
                }
            } else {
                if (message.type === "offer") {
                    console.log("Received offer signal:", message.offer);
                    const answer = {};  // You would handle answer creation in WebRTC here
                    this.socket.emit("signal", {
                        sessionId: this.sessionId,
                        data: { type: "answer", answer }
                    });
                }
            }

            if (message.type === "ice-candidate") {
                console.log("Received ICE candidate:", message.candidate);
            }
        });

        this.socket.on("connect", () => {
            console.log("WebSocket connected to:", websocketURL);
            this.isConnected = true;
        });
    }

    sendMessage(message) {
        if (this.socket && this.isConnected) {
            const msgData = { type: "message", content: message };
            this.socket.emit("signal", {
                sessionId: this.sessionId,
                data: msgData
            });
            console.log("Message sent:", message);
        } else {
            console.warn("Not connected. Cannot send message.");
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.isConnected = false;
        }
    }
}

function startSender() {
    rl.question("Enter the 3-word session ID: ", (inputSessionId) => {
        sessionId = inputSessionId.trim();

        // Create WebRTCService instance
        webrtcService = new WebRTCService((message) => {
            console.log("Received:", message);
        }, true);

        // Connect to the WebSocket server
        webrtcService.connect(websocketURL, sessionId);

        // Start listening for messages to send
        messageLoop();
    });
}

function messageLoop() {
    rl.question("Type a message to send: ", (message) => {
        if (webrtcService && isConnected) {
            webrtcService.sendMessage(message);
        } else {
            console.warn("Not connected. Message not sent.");
        }
        messageLoop(); // Recursively loop to allow continuous input
    });
}

// Start the sender app
startSender();