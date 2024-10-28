const { app, Tray, Menu, shell, clipboard } = require("electron");
const path = require("path");
const fs = require("fs");
const webrtc = require("./webrtc");

let tray;
let lastText = "";

const logFilePath = path.join(app.getPath("userData"), "log.txt");

function logMessage(message) {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logFilePath, `[${timestamp}] ${message}\n`);
}

app.on("ready", () => {
    // Log start of the session
    logMessage("App started");

    // Generate a session ID and start the WebRTC connection
    const sessionId = webrtc.startSession();
    logMessage(`Session ID: ${sessionId}`);

    // Set up system tray icon
    tray = new Tray(path.join(__dirname, "icon.png"));
    tray.setToolTip(`Session ID: ${sessionId}`);

    // Add context menu with options
    const contextMenu = Menu.buildFromTemplate([
        {
            label: "Open Log Directory",
            click: () => {
                shell.showItemInFolder(logFilePath); // Opens the log file directory
            }
        },
        {
            label: "Copy Session ID",
            click: () => {
                clipboard.writeText(sessionId); // Copies the session ID to clipboard
                logMessage("Session ID copied to clipboard");
            }
        },
        { type: "separator" },
        { label: "Quit", click: () => app.quit() },
    ]);
    tray.setContextMenu(contextMenu);

    // Monitor the clipboard for text changes every second
    setInterval(() => {
        const currentText = clipboard.readText();
        if (currentText && currentText !== lastText) {
            webrtc.sendMessage(currentText);
            lastText = currentText;
            logMessage(`Clipboard changed: ${currentText}`);
        }
    }, 1000);
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});
