const { app, Tray, Menu, shell, clipboard } = require("electron");
const path = require("path");
const fs = require("fs");
const { Monitor } = require("node-screenshots");
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


async function captureAndProcessScreen() {
    const { x, y, width, height } = config.captureArea;

    // Capture and crop the screen
    try {
        const monitor = Monitor.all().find(m => m.isPrimary); // Capture from the primary monitor
        const fullImage = await monitor.captureImage(); // Capture the screen
        const croppedImage = await fullImage.crop(x, y, width, height); // Crop the image

        const buffer = await croppedImage.toPng(); // Convert cropped image to buffer
        const recognizedText = await performOCR(buffer); // OCR on cropped image

        if (recognizedText) {
            webrtc.sendMessage(recognizedText); // Send OCR result over WebRTC
            logMessage(`Captured OCR text: ${recognizedText}`);
        }
    } catch (error) {
        console.error("Screen capture or OCR failed:", error);
        logMessage("Error during screen capture or OCR");
    }
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