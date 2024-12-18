const { io } = require("socket.io-client");
const { RTCPeerConnection, RTCSessionDescription } = require("wrtc");
const { EventEmitter } = require("events");
const faker = require("@faker-js/faker").faker;
const iceServers = require("./iceServers");

const WEBSOCKET_URL = "wss://owd.acecentre.net";
//const WEBSOCKET_URL = "ws://localhost:3000";

class WebRTCConnection extends EventEmitter {
    constructor(config) {
        super();
        this.peerConnections = {};
        this.dataChannels = {};
        this.config;
        this.sessionId = this.getSessionId();
        this.socket = io(WEBSOCKET_URL, { transports: ["websocket"], withCredentials: true });
        this.setupSocketListeners();
    }

    updateConfig(newConfig) {
        this.config = newConfig;
        this.sessionId = this.getSessionId();
    }
    
    generateSessionId() {
        const word1 = faker.word.adjective();
        const word2 = faker.word.adjective();
        const word3 = faker.word.noun();
        return `${word1}-${word2}-${word3}`;
    }

    getSessionId() {
        if (this.config && this.config.sessionId) {
            this.sessionPersistent = true;
            return this.config.sessionId;
        } else {
            this.sessionPersistent = false;
            return this.generateSessionId();
        }
    }

    startSession() {
        console.log(`Session ID: ${this.sessionId}`);
        return this.sessionId;
    }

    setupSocketListeners() {
        this.getSessionId()
        this.socket.on("connect", () => {
            this.socket.emit("joinSession", this.sessionId, this.sessionPersistent);
            this.emit("connected"); // Emit connected event
        });

        this.socket.on("disconnect", () => {
            this.emit("disconnected"); // Emit disconnected event
        });

        this.socket.on("peerJoined", async (data) => {
            try {
                const peerId = data.peerId;
                const peerConnection = new RTCPeerConnection({ iceServers });

                this.peerConnections[peerId] = peerConnection;

                peerConnection.onicecandidate = (event) => {
                    if (event.candidate) {
                        this.socket.emit("signal", {
                            sessionId: this.sessionId,
                            peerId: peerId,
                            data: { type: "ice-candidate", candidate: event.candidate },
                        });
                    }
                };

                const dataChannel = peerConnection.createDataChannel("messaging");
                this.dataChannels[peerId] = dataChannel;

                dataChannel.onopen = () => {
                    this.emit("connected");
                    const channelConnectedMessage = JSON.stringify({ type: "CHANNEL_CONNECTED" });
                    dataChannel.send(channelConnectedMessage);
                    console.log("Sent CHANNEL_CONNECTED message to display.");
                };

                dataChannel.onclose = () => {
                    this.emit("disconnected"); // Emit disconnected event when data channel closes
                };

                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);

                this.socket.emit("signal", {
                    sessionId: this.sessionId,
                    peerId: peerId,
                    data: { type: "offer", offer },
                });
            } catch (error) {
                console.error("Error in peerJoined event:", error);
            }
        });

        this.socket.on("signal", async (message) => {
            const { peerId, data } = message;
            const peerConnection = this.peerConnections[peerId];

            if (data.type === "offer") {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                this.socket.emit("signal", { sessionId: this.sessionId, peerId: peerId, data: { type: "answer", answer } });
            } else if (data.type === "answer") {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
            } else if (data.type === "ice-candidate" && data.candidate) {
                await peerConnection.addIceCandidate(data.candidate);
            }
        });
    }

    sendMessage(content) {
        const message = JSON.stringify({ type: "MESSAGE", content });

        Object.values(this.dataChannels).forEach((channel) => {
            if (channel.readyState === "open") {
                channel.send(message);
            }
        });
    }

    isChannelOpen() {
        return Object.values(this.dataChannels).some(channel => channel.readyState === "open");
    }

    closeConnection() {
        Object.values(this.peerConnections).forEach((peerConnection) => {
            peerConnection.close();
        });
        Object.values(this.dataChannels).forEach((dataChannel) => {
            if (dataChannel.readyState !== "closed") {
                dataChannel.close();
            }
        });

        // Clear the connection objects
        this.peerConnections = {};
        this.dataChannels = {};

        // Disconnect the WebSocket connection
        if (this.socket.connected) {
            this.socket.disconnect();
        }

        this.emit("disconnected");
        console.log("WebRTC connection closed.");
    }
}

module.exports = WebRTCConnection;
