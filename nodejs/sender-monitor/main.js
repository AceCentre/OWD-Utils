const { app, Tray, Menu, shell, clipboard } = require("electron");
const path = require("path");
const fs = require("fs");
const webrtc = require("./webrtc");

let tray;
let lastText = "";
let isConnected = false;

const logFilePath = path.join(app.getPath("userData"), "log.txt");

function getIconPath(iconName) {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, "assets", "icons", iconName);
    } else {
        return path.join(__dirname, "assets", "icons", iconName);
    }
}


function logMessage(message) {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logFilePath, `[${timestamp}] ${message}\n`);
}

function updateTrayIcon() {
    const iconPath = isConnected
        ? getIconPath("icon-connected.png")
        : getIconPath("icon-disconnected.png");
    tray.setImage(iconPath);
}

app.on("ready", () => {
    // Log start of the session
    logMessage("App started");

    // Generate a session ID and start the WebRTC connection
    const sessionId = webrtc.startSession();
    logMessage(`Session ID: ${sessionId}`);

    // Set up system tray icon initially as disconnected
    tray = new Tray(getIconPath("icon-disconnected.png"));
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

    // Listen for WebRTC connection changes
    webrtc.on("connected", () => {
        isConnected = true;
        updateTrayIcon();
        logMessage("Connected to WebRTC peer");
    });

    webrtc.on("disconnected", () => {
        isConnected = false;
        updateTrayIcon();
        logMessage("Disconnected from WebRTC peer");
    });

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
