const { app, Tray, Menu, shell, clipboard, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const webrtc = require("./webrtc");
const QRCode = require("qrcode");
const { Monitor } = require("node-screenshots");
const { performOCR } = require("./ocr");
const { Translator } = require("google-translate-api-x");

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

function createOverlayWindow() {
    let overlayWindow = new BrowserWindow({
        fullscreen: true,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: false,
        webPreferences: {
            contextIsolation: true,
            preload: path.join(__dirname, "overlay-preload.js"),
        },
    });

    overlayWindow.loadURL(`file://${__dirname}/overlay.html`);
    overlayWindow.on("closed", () => {
        overlayWindow = null;
    });
}

ipcMain.on("set-ocr-boundaries", (event, bounds) => {
    config.captureArea = bounds;
    logMessage(`Updated OCR boundaries: ${JSON.stringify(bounds)}`);
    // Save updated config if persistence is needed
    fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2), "utf-8");
});

async function createQRWindow(qrDataUrl) {
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
            preload: path.join(__dirname, "preload.js"),
        }
    });

    const htmlContent = `
        <html>
            <body style="display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 0;">
                <button id="closeButton" style="position: absolute; top: 10px; right: 10px; padding: 2px 6px; cursor: pointer;">✖</button>
                <img src="${qrDataUrl}" width="200" height="200" style="display: block; margin-top: 20px;" />
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
        qrWindow = null;
    });
}

function reloadConfig() {
    try {
        config = JSON.parse(fs.readFileSync(configFilePath, "utf-8"));
        console.log("Configuration reloaded.");
        logMessage("Configuration reloaded from config.json.");

        // Stop any existing monitoring intervals
        if (clipboardMonitorInterval) {
            clearInterval(clipboardMonitorInterval);
            clipboardMonitorInterval = null;
        }
        if (ocrMonitorInterval) {
            clearInterval(ocrMonitorInterval);
            ocrMonitorInterval = null;
        }

        // Start the appropriate monitoring based on the reloaded config
        if (config.monitorMode === "clipboard") {
            clipboardMonitorInterval = setInterval(() => {
                const currentText = clipboard.readText();
                processAndSendText(currentText);
            }, config.captureInterval);
            console.log("Switched to clipboard monitoring mode.");
            logMessage("Switched to clipboard monitoring mode.");
        } else if (config.monitorMode === "ocr") {
            ocrMonitorInterval = setInterval(async () => {
                const recognizedText = await captureAndProcessScreen();
                processAndSendText(recognizedText);
            }, config.captureInterval);
            console.log("Switched to OCR monitoring mode.");
            logMessage("Switched to OCR monitoring mode.");
        }

    } catch (error) {
        console.error("Failed to reload config:", error);
        logMessage("Failed to reload config.");
    }
}

// Capture and OCR function with return of recognized text
async function captureAndProcessScreen() {
    const { x, y, width, height, useEdgeForOCR } = config.captureArea;

    try {
        const monitor = Monitor.all().find(m => m.isPrimary);
        const fullImage = await monitor.captureImage();
        const croppedImage = await fullImage.crop(x, y, width, height);

        const filePath = path.join(app.getPath("temp"), "ocr-capture.png");

        // Write the cropped image to the temp path and ensure it exists
        fs.writeFileSync(filePath, await croppedImage.toPng());
        if (!fs.existsSync(filePath)) {
            console.error("Image file not created as expected at", filePath);
            return ""; // Exit early if file creation failed
        }

        const recognizedText = await performOCR(filePath, useEdgeForOCR);
        console.log("OCR completed, recognized text:", recognizedText);

        // Clean up the temp file only after OCR completes
        fs.unlinkSync(filePath);
        return recognizedText || ""; // Return the OCR text or an empty string

    } catch (error) {
        console.error("Screen capture or OCR failed:", error);
        logMessage("Error during screen capture or OCR");
        return "";
    }
}

const translator = new Translator({
    from: config.translation?.sourceLang || "en",
    to: config.translation?.targetLang || "es",
    autoCorrect: config.translation?.autoCorrect || false,
    forceBatch: false,
    tld: "com",
});

async function processAndSendText(text) {
    if (text && text !== lastText && isConnected && webrtc.isChannelOpen()) {
        if (config.translation?.enabled || false) {
            try {
                const translated = await translator.translate(text);
                text = translated.text;
                console.log(`Translated text: ${text}`);
            } catch (error) {
                console.error("Translation error:", error);
            }
        }

        webrtc.sendMessage(text);
        lastText = text;
        console.log(`Text sent to display: ${text}`);
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
        {
            label: "Show QR Code",
            click: async () => {
                try {
                    const qrDataUrl = await QRCode.toDataURL(displayAppURL); // Generate fresh QR code
                    createQRWindow(qrDataUrl);
                } catch (error) {
                    console.error("Failed to generate QR code:", error);
                }
            }
        },
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
            label: "Define OCR Area", // New option to define OCR area
            click: createOverlayWindow,
        },
        {
            label: "Reload Config",
            click: reloadConfig,
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

    QRCode.toDataURL(displayAppURL)
        .then((url) => {
            createQRWindow(url); // Show QR code on startup with generated data URL
            updateTrayMenu();    // Initialize tray menu
        })
        .catch((err) => console.error("Failed to generate QR code:", err));

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

    if (webrtc.connected) {  // Replace `connected` with the correct property or method if different
        try {
            await webrtc.closeConnection();  // Make sure closeConnection is a Promise, or remove `await`
            logMessage("WebRTC connection closed.");
        } catch (error) {
            logMessage(`Failed to close WebRTC connection: ${error.message}`);
        }
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
