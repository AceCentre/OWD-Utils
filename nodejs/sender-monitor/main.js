const { app, Tray, Menu } = require("electron");
const path = require("path");
const clipboard = require("clipboardy");
const webrtc = require("./webrtc");

let tray;
let lastText = "";

app.on("ready", () => {
    // Generate a session ID and start the WebRTC connection
    const sessionId = webrtc.startSession();

    // Set up system tray icon
    tray = new Tray(path.join(__dirname, "icon.png"));
    tray.setToolTip(`Session ID: ${sessionId}`);

    // Add context menu with options
    const contextMenu = Menu.buildFromTemplate([
        { label: "Quit", click: () => app.quit() },
    ]);
    tray.setContextMenu(contextMenu);

    // Monitor the clipboard for text changes every second
    setInterval(async () => {
        const currentText = clipboard.readSync();

        // If new text, send over WebRTC connection
        if (currentText && currentText !== lastText) {
            webrtc.sendMessage(currentText);
            lastText = currentText;
        }
    }, 1000);
});

app.on("window-all-closed", () => {
    // Ensure the app runs in the background
    if (process.platform !== "darwin") app.quit();
});