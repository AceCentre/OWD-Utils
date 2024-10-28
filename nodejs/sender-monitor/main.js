const { app, Tray, Menu, shell, clipboard } = require("electron");
const path = require("path");
const fs = require("fs");
const robot = require("robotjs");
const ocr = require("./ocr");
const webrtc = require("./webrtc");
const config = require("./config.json");  // Load configuration

let tray;
let lastText = "";
let isConnected = false;

const logFilePath = path.join(app.getPath("userData"), "log.txt");

function getIconPath(iconName) {
    return app.isPackaged ? path.join(process.resourcesPath, iconName) : path.join(__dirname, iconName);
}

function logMessage(message) {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logFilePath, `[${timestamp}] ${message}\n`);
}

function updateTrayIcon() {
    const iconPath = isConnected ? getIconPath("icon-connected.png") : getIconPath("icon-disconnected.png");
    tray.setImage(iconPath);
}

async function captureScreenAreaAndProcess() {
    const { x, y, width, height } = config.captureArea;
    const screenCapture = robot.screen.capture(x, y, width, height);
    const filePath = path.join(__dirname, "temp-capture.png");

    fs.writeFileSync(filePath, screenCapture.image);

    const recognizedText = await ocr.performOCR(filePath);
    if (recognizedText) {
        webrtc.sendMessage(recognizedText);
        logMessage(`Sent recognized text: ${recognizedText}`);
    }

    fs.unlinkSync(filePath);
}

app.on("ready", () => {
    logMessage("App started");

    const sessionId = webrtc.startSession();
    logMessage(`Session ID: ${sessionId}`);

    tray = new Tray(getIconPath("icon-disconnected.png"));
    tray.setToolTip(`Session ID: ${sessionId}`);

    const contextMenu = Menu.buildFromTemplate([
        { label: "Open Log Directory", click: () => shell.showItemInFolder(logFilePath) },
        { label: "Copy Session ID", click: () => clipboard.writeText(sessionId) },
        { type: "separator" },
        { label: "Quit", click: () => app.quit() }
    ]);
    tray.setContextMenu(contextMenu);

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

    // Choose monitoring mode based on config setting
    if (config.monitorMode === "clipboard") {
        // Clipboard monitoring
        setInterval(() => {
            const currentText = clipboard.readText();
            if (currentText && currentText !== lastText) {
                webrtc.sendMessage(currentText);
                lastText = currentText;
                logMessage(`Clipboard changed: ${currentText}`);
            }
        }, config.captureInterval);
    } else if (config.monitorMode === "ocr") {
        // OCR-based screen area capture
        setInterval(captureScreenAreaAndProcess, config.captureInterval);
    }
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});