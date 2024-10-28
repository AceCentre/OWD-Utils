const { io } = require("socket.io-client");
const faker = require("@faker-js/faker").faker;
const { RTCPeerConnection, RTCSessionDescription } = require("wrtc");

const WEBSOCKET_URL = "wss://owd.acecentre.net";
const BASE_URL = "https://owd.acecentre.net/";

const generateSessionId = () => {
    const word1 = faker.word.adjective();
    const word2 = faker.word.adjective();
    const word3 = faker.word.noun();
    return `${word1}-${word2}-${word3}`;
};

const sessionId = generateSessionId();
const socket = io(WEBSOCKET_URL, { transports: ["websocket"], withCredentials: true });
const peerConnections = {};
const dataChannels = {};

// Start session and display QR code
function startSession() {
    console.log(`Session ID: ${sessionId}`);
    const sessionURL = `${BASE_URL}?sessionId=${sessionId}`;
    return sessionId;
}

socket.on("connect", () => socket.emit("joinSession", sessionId));

socket.on("peerJoined", async (data) => {
    const peerId = data.peerId;
    const peerConnection = new RTCPeerConnection();

    peerConnections[peerId] = peerConnection;

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit("signal", {
                sessionId,
                peerId,
                data: { type: "ice-candidate", candidate: event.candidate },
            });
        }
    };

    const dataChannel = peerConnection.createDataChannel("messaging");
    dataChannels[peerId] = dataChannel;

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.emit("signal", {
        sessionId,
        peerId,
        data: { type: "offer", offer },
    });
});

socket.on("signal", async (message) => {
    const { peerId, data } = message;
    const peerConnection = peerConnections[peerId];

    if (data.type === "offer") {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit("signal", { sessionId, peerId, data: { type: "answer", answer } });
    } else if (data.type === "answer") {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    } else if (data.type === "ice-candidate" && data.candidate) {
        await peerConnection.addIceCandidate(data.candidate);
    }
});

function sendMessage(content) {
    const message = JSON.stringify({ type: "MESSAGE", content });

    Object.values(dataChannels).forEach((channel) => {
        if (channel.readyState === "open") {
            channel.send(message);
        }
    });
}

module.exports = { startSession, sendMessage };