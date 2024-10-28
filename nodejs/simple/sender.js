const { io } = require("socket.io-client");
const faker = require("@faker-js/faker").faker;
const readline = require("readline");
const qrcode = require("qrcode-terminal");
const { RTCPeerConnection, RTCSessionDescription } = require("wrtc");

const WEBSOCKET_URL = "ws://owd.acecentre.net";
const BASE_URL = "https://owd.acecentre.net/";

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

const peerConnections = {};
const dataChannels = {};

const socket = io(WEBSOCKET_URL, {
    transports: ["websocket"],
    withCredentials: true,
});

let isConnected = false;

socket.on("connect", () => {
    isConnected = true;
    socket.emit("joinSession", sessionId);
});

socket.on("peerJoined", async (data) => {
    const peerId = data.peerId;
    const peerConnection = new RTCPeerConnection();

    peerConnections[peerId] = peerConnection;

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit("signal", {
                sessionId: sessionId,
                peerId: peerId,
                data: { type: "ice-candidate", candidate: event.candidate },
            });
        }
    };

    const dataChannel = peerConnection.createDataChannel("messaging");
    dataChannels[peerId] = dataChannel;

    dataChannel.onopen = () => {
        askForMessage();
    };

    dataChannel.onmessage = (event) => {
        console.log(`Message from ${peerId}: ${event.data}`);
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.emit("signal", {
        sessionId: sessionId,
        peerId: peerId,
        data: { type: "offer", offer },
    });
});

socket.on("signal", async (message) => {
    const { peerId, data } = message;
    const peerConnection = peerConnections[peerId];

    if (data.type === "offer") {
        await peerConnection.setRemoteDescription(
            new RTCSessionDescription(data.offer)
        );
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        socket.emit("signal", {
            sessionId: sessionId,
            peerId: peerId,
            data: { type: "answer", answer },
        });
    } else if (data.type === "answer") {
        await peerConnection.setRemoteDescription(
            new RTCSessionDescription(data.answer)
        );
    } else if (data.type === "ice-candidate") {
        if (data.candidate) {
            await peerConnection.addIceCandidate(data.candidate);
        }
    }
});

socket.on("disconnect", () => {
    isConnected = false;
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
        if (isConnected) {
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
            console.log("Not connected. Please wait until connected.");
        }
    } else {
        sendTypingNotification();
    }
});

const sendMessage = (content, isTyping = false) => {
    const message = JSON.stringify({
        type: isTyping ? "TYPING" : "MESSAGE",
        content: content,
        isLiveTyping: false,
    });

    Object.keys(dataChannels).forEach((peerId) => {
        const channel = dataChannels[peerId];
        if (channel && channel.readyState === "open") {
            channel.send(message);
        } else {
            console.warn(
                `Data channel is not open for ${peerId}. Message not sent.`
            );
        }
    });
};

let isReadlineClosed = false;

const askForMessage = () => {
    if (isConnected && !isReadlineClosed) {
        rl.question("Enter your message (or 'exit' to quit): ", (message) => {
            if (message.toLowerCase() === "exit") {
                isReadlineClosed = true;
                rl.close();
                socket.disconnect();
                return;
            }
            sendMessage(message, false);
            askForMessage();
        });
    } else {
        console.log("Not connected. Please wait until connected.");
    }
};

rl.on('close', () => {
    isReadlineClosed = true;
    console.log('Readline interface closed.');
});