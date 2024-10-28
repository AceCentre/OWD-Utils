const { io } = require("socket.io-client");
const faker = require("@faker-js/faker").faker;
const readline = require("readline");
const qrcode = require("qrcode-terminal");
const SimplePeer = require("simple-peer");

const WEBSOCKET_URL = "ws://localhost:3000";
const BASE_URL = "http://localhost:3000/sender";

const generateSessionId = () => {
    const word1 = faker.word.adjective();
    const word2 = faker.word.adjective();
    const word3 = faker.word.noun();
    return `${word1}-${word2}-${word3}`;
};
const sessionId = generateSessionId();

const sessionURL = `${BASE_URL}?sessionId=${sessionId}`;
qrcode.generate(sessionURL, { small: true });
console.log(`Session ID: ${sessionId}`);

const peers = {};
const socket = io(WEBSOCKET_URL, {
    transports: ["websocket"],
    withCredentials: true,
});

socket.on("connect", () => {
    socket.emit("joinSession", sessionId);
});

// Handle when a new peer joins
socket.on("peerJoined", (data) => {
    const peerId = data.peerId;
    const peer = new SimplePeer({ initiator: true });

    peers[peerId] = peer;

    // Send any generated signaling data to the signaling server
    peer.on("signal", (signalData) => {
        socket.emit("signal", { sessionId, peerId, data: signalData });
    });

    peer.on("connect", () => {
        console.log(`Connected to peer ${peerId}`);
    });

    peer.on("data", (data) => {
        console.log(`Message from ${peerId}: ${data.toString()}`);
    });
});

// Handle incoming signaling data
socket.on("signal", (message) => {
    const { peerId, data } = message;

    // Check if the peer already exists
    if (!peers[peerId]) {
        peers[peerId] = new SimplePeer();
        peers[peerId].on("signal", (signalData) => {
            socket.emit("signal", { sessionId, peerId, data: signalData });
        });
        peers[peerId].on("connect", () => {
            console.log(`Connected to peer ${peerId}`);
        });
        peers[peerId].on("data", (data) => {
            console.log(`Message from ${peerId}: ${data.toString()}`);
        });
    }
    peers[peerId].signal(data);
});

socket.on("disconnect", () => {
    console.log("Disconnected from WebSocket server.");
});

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

let typingTimeout;
let isTyping = false;

const sendTypingNotification = () => {
    if (!isTyping) {
        isTyping = true;
        sendMessage("User is typing...", true);
    }

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        if (isTyping) {
            sendMessage("User stopped typing", true);
            isTyping = false;
        }
    }, 1000);
};

process.stdin.on("keypress", (str, key) => {
    if (key.name === "return") {
        rl.question("Enter your message (or 'exit' to quit): ", (message) => {
            if (message.toLowerCase() === "exit") {
                rl.close();
                socket.disconnect();
                return;
            }
            sendMessage(message, false);
            isTyping = false;
            clearTimeout(typingTimeout);
        });
    } else {
        sendTypingNotification();
    }
});

const sendMessage = (message) => {
    Object.values(peers).forEach((peer) => {
        if (peer.connected) {
            peer.send(message);
        } else {
            console.warn("Peer is not connected. Message not sent.");
        }
    });
};

const askForMessage = () => {
    rl.question("Enter your message (or 'exit' to quit): ", (message) => {
        if (message.toLowerCase() === "exit") {
            rl.close();
            socket.disconnect();
            return;
        }
        sendMessage(message, false);
        askForMessage();
    });
};
