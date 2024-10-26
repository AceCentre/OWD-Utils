const io = require("socket.io-client");
const faker = require("@faker-js/faker").faker;
const readline = require("readline");
const qrcode = require("qrcode-terminal");

// Configuration
const WEBSOCKET_URL = "ws://localhost:3000"; // Replace with your server URL
const BASE_URL = "http://localhost:3000/sender"; // Base URL for QR code

// Generate session ID
const generateSessionId = () => {
    const word1 = faker.word.adjective();
    const word2 = faker.word.adjective();
    const word3 = faker.word.noun();
    return `${word1}-${word2}-${word3}`;
};
const sessionId = generateSessionId();

// Display QR code in the terminal
const sessionURL = `${BASE_URL}?sessionId=${sessionId}`;
qrcode.generate(sessionURL, { small: true });
console.log(`Session ID: ${sessionId}`);
console.log(`Scan the QR code above or visit: ${sessionURL}\n`);

// WebSocket connection
const socket = io(WEBSOCKET_URL, {
    transports: ["websocket"],
    withCredentials: true,
});

socket.on("connect", () => {
    console.log("Connected to WebSocket server.");
    socket.emit("joinSession", sessionId);

    // Notify channel connection
    socket.emit("signal", {
        sessionId: sessionId,
        data: JSON.stringify({ type: "channelConnected" }),
    });
});

socket.on("disconnect", () => {
    console.log("Disconnected from WebSocket server.");
});

// Input and message handling
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

// Prompt user for message and handle live typing
const askForMessage = () => {
    rl.question("Enter your message (or 'exit' to quit): ", (message) => {
        if (message.toLowerCase() === "exit") {
            rl.close();
            socket.disconnect();
            return;
        }
        sendMessage(message);
        askForMessage();
    });
};

// Send a regular or live typing message
const sendMessage = (content, isTyping = false) => {
    const message = {
        type: isTyping ? "typing" : "message",
        content: content,
        isLiveTyping: false, // Adjust this if live typing should be enabled
    };
    socket.emit("signal", {
        sessionId: sessionId,
        data: JSON.stringify(message),
    });
    if (!isTyping) console.log(`Message sent: ${content}`);
};

// Listen for typing event
rl.on("line", (input) => {
    sendMessage(input, true); // Send typing event
});

// Start the main prompt loop
askForMessage();