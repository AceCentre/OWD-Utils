const { app, Tray, Menu, shell, clipboard, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const webrtc = require("./webrtc");
const QRCode = require("qrcode");
const { Monitor } = require("node-screenshots");
const { performOCR } = require("./ocr");

let tray;
let qrWindow;
let lastText = "";
let isConnected = false;
let retryAttempts = 0;
let sessionId;
let displayAppURL;
let clipboardMonitorInterval;
let ocrMonitorInterval;
const maxRetries = 10;
const retryInterval = 3000;

const logFilePath = path.join(app.getPath("userData"), "log.txt");

const configFilePath = app.isPackaged
    ? path.join(app.getPath("userData"), "config.json")
    : path.join(__dirname, "config.json");

if (app.isPackaged && !fs.existsSync(configFilePath)) {
    fs.copyFileSync(path.join(__dirname, "config.json"), configFilePath);
}

let config = JSON.parse(fs.readFileSync(configFilePath, "utf-8"));


ipcMain.on("close-qr-window", () => {
    if (qrWindow) {
        qrWindow.close();
    }
});

function createQRWindow(url) {
    if (qrWindow) {
        qrWindow.close();
    }

    qrWindow = new BrowserWindow({
        width: 220,
        height: 240,
        frame: false,
        alwaysOnTop: true,
        resizable: false,
        show: false,
        webPreferences: {
            contextIsolation: true,
            preload: path.join(__dirname, "preload.js"), // Preload script for IPC
        }
    });

    const htmlContent = `
        <html>
            <body style="display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 0;">
                <button id="closeButton" style="position: absolute; top: 10px; right: 10px; padding: 2px 6px; cursor: pointer;">✖</button>
                <img src="${url}" width="200" height="200" style="display: block; margin-top: 20px;" />
                <script>
                    document.getElementById("closeButton").addEventListener("click", () => {
                        window.closeQRWindow();
                    });
                </script>
            </body>
        </html>`;

    qrWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    qrWindow.show();

    qrWindow.on("closed", () => {
        qrWindow = null; // Nullify qrWindow when it's closed
    });
}

// Capture and OCR function with return of recognized text
async function captureAndProcessScreen() {
    const { x, y, width, height, useEdgeForOCR } = config.captureArea;

    try {
        const monitor = Monitor.all().find(m => m.isPrimary);
        const fullImage = await monitor.captureImage();
        const croppedImage = await fullImage.crop(x, y, width, height);

        const filePath = path.join(app.getPath("temp"), "ocr-capture.png");
        fs.writeFileSync(filePath, await croppedImage.toPng());

        const recognizedText = await performOCR(filePath, useEdgeForOCR);

        fs.unlinkSync(filePath);  // Clean up temp file

        return recognizedText || ""; // Return the OCR text or an empty string
    } catch (error) {
        console.error("Screen capture or OCR failed:", error);
        logMessage("Error during screen capture or OCR");
        return "";
    }
}

function processAndSendText(text) {
    if (text && text !== lastText) {
        webrtc.sendMessage(text);
        lastText = text;
        logMessage(`Text sent: ${text}`);
    }
}

function getIconPath(iconName) {
    if (app.isPackaged) {
        // Path for the production app (packaged)
        return path.join(process.resourcesPath, "assets", iconName);
    } else {
        // Path for development mode
        return path.join(__dirname, "assets", iconName);
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
    logMessage(`Trying to load icon from path: ${iconPath}`);

    try {
        tray.setImage(iconPath);
    } catch (error) {
        logMessage(`Failed to set tray icon: ${error.message}`);
    }
}

function manualReconnect() {
    retryAttempts = 0;
    logMessage("Manual reconnect initiated from taskbar.");
    attemptConnection();
}

function attemptConnection() {
    retryAttempts++;
    console.log(`Attempting to reconnect (${retryAttempts}/${maxRetries})...`);

    // Attach the event listener for connection success only once
    webrtc.once("connected", () => {
        isConnected = true;
        updateConnectionStatus(true);
        logMessage("Reconnected to WebRTC peer");
        retryAttempts = 0; // Reset retry attempts
    });

    // Attach the event listener for disconnection only once
    webrtc.once("disconnected", () => {
        isConnected = false;
        updateConnectionStatus(false)
        logMessage("Disconnected from WebRTC peer");

        // Retry connection if attempts are available
        if (retryAttempts < maxRetries) {
            setTimeout(attemptConnection, retryInterval);
        } else {
            console.error("Max retries reached. Could not reconnect to peer.");
            logMessage("Max retries reached. Could not reconnect to peer.");
        }
    });
}

function updateTrayMenu() {
    const contextMenu = Menu.buildFromTemplate([
        { label: "Show QR Code", click: () => createQRWindow(displayAppURL) },
        {
            label: "Reconnect",
            click: manualReconnect,
            enabled: !isConnected, // Disable the option if connected
        },
        {
            label: "Open Log Directory",
            click: () => shell.showItemInFolder(logFilePath),
        },
        {
            label: "Open Config",
            click: () => shell.openPath(configFilePath)
                .catch(err => console.error("Failed to open config file:", err))
        },
        {
            label: "Copy Session ID",
            click: () => {
                clipboard.writeText(sessionId);
                logMessage("Session ID copied to clipboard");
            },
        },
        { type: "separator" },
        { label: "Quit", click: () => app.quit() },
    ]);
    tray.setContextMenu(contextMenu);
}

app.on("ready", () => {
    logMessage("App started");

    sessionId = webrtc.startSession();
    logMessage(`Session ID: ${sessionId}`);
    displayAppURL = `https://owd.acecentre.net/?sessionId=${sessionId}`;

    tray = new Tray(getIconPath("icon-disconnected.png"));
    tray.setToolTip(`Session ID: ${sessionId}`);

    QRCode.toDataURL(displayAppURL, (err, url) => {
        if (err) {
            console.error("Failed to generate QR code:", err);
        } else {
            // Show the QR code window at startup
            createQRWindow(url);

            // Set up tray context menu with the QR option and other options
            updateTrayMenu();
        }
    });

    attemptConnection();

    // Clipboard monitoring
    if (config.monitorMode === "clipboard") {
        clipboardMonitorInterval = setInterval(() => {
            const currentText = clipboard.readText();
            processAndSendText(currentText);
        }, config.captureInterval);
    } else if (config.monitorMode === "ocr") {
        ocrMonitorInterval = setInterval(async () => {
            const recognizedText = await captureAndProcessScreen();
            processAndSendText(recognizedText);
        }, config.captureInterval);
    }
});

function updateConnectionStatus(connected) {
    isConnected = connected;
    updateTrayIcon();
    updateTrayMenu();
}


app.on("before-quit", async () => {
    logMessage("App quitting...");

    // Terminate any OCR process if in progress
    if (config.monitorMode === "ocr") {
        if (performOCR.terminate) {
            try {
                await performOCR.terminate();
                logMessage("OCR worker terminated.");
            } catch (error) {
                logMessage(`Failed to terminate OCR worker: ${error.message}`);
            }
        }
    }

    if (webrtc.isConnected()) {
        webrtc.closeConnection();
        logMessage("WebRTC connection closed.");
    }

    const tempFilePath = path.join(app.getPath("temp"), "ocr-capture.png");
    if (fs.existsSync(tempFilePath)) {
        try {
            fs.unlinkSync(tempFilePath);
            logMessage("Temporary OCR file cleaned up.");
        } catch (error) {
            logMessage(`Failed to delete temp OCR file: ${error.message}`);
        }
    }

    // Clear intervals if they are set
    if (clipboardMonitorInterval) {
        clearInterval(clipboardMonitorInterval);
        logMessage("Clipboard monitoring interval cleared.");
    }
    if (ocrMonitorInterval) {
        clearInterval(ocrMonitorInterval);
        logMessage("OCR monitoring interval cleared.");
    }
});

app.on("window-all-closed", (e) => {
    e.preventDefault();
});
