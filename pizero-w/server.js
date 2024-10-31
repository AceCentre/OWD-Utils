
const fs = require("fs");
const { PythonShell } = require("python-shell");
const { RTCPeerConnection, RTCSessionDescription } = require("wrtc");
const io = require("socket.io-client");

const config = JSON.parse(fs.readFileSync("config.json", "utf8"));
const signalingServerUrl = "https://your-signaling-server.com";
const socket = io(signalingServerUrl);

let peerConnection;
let dataChannel;

function setupWebRTC() {
    peerConnection = new RTCPeerConnection();

    dataChannel = peerConnection.createDataChannel("displayChannel");
    dataChannel.onmessage = (event) => updateDisplay(event.data);

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit("candidate", event.candidate);
        }
    };

    socket.emit("join", { sessionId: config.sessionId });

    socket.on("offer", async (offer) => {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit("answer", answer);
    });

    socket.on("candidate", (candidate) => {
        peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    });
}

function updateDisplay(text) {
    const options = {
        args: [text, config.fontSize, config.lines, config.scrolling]
    };

    PythonShell.run("display_text.py", options, (err) => {
        if (err) console.error("Error updating display:", err);
    });
}

setupWebRTC();
