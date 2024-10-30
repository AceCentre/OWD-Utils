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


app.on("ready", () => {
    logMessage("App started");

    const sessionId = webrtc.startSession();
    logMessage(`Session ID: ${sessionId}`);
    const displayAppURL = `https://owd.acecentre.net/?sessionId=${sessionId}`;

    tray = new Tray(getIconPath("icon-disconnected.png"));
    tray.setToolTip(`Session ID: ${sessionId}`);

    QRCode.toDataURL(displayAppURL, (err, url) => {
        if (err) {
            console.error("Failed to generate QR code:", err);
        } else {
            // Show the QR code window at startup
            createQRWindow(url);

            // Set up tray context menu with the QR option and other options
            const contextMenu = Menu.buildFromTemplate([
                { label: "Show QR Code", click: () => createQRWindow(url) },
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
    });

    // WebRTC connection events
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

    // Clipboard monitoring
    if (config.monitorMode === "clipboard") {
        setInterval(() => {
            const currentText = clipboard.readText();
            processAndSendText(currentText);
        }, config.captureInterval);
    } else if (config.monitorMode === "ocr") {
        setInterval(async () => {
            const recognizedText = await captureAndProcessScreen();
            processAndSendText(recognizedText);
        }, config.captureInterval);
    }
});


app.on("window-all-closed", (e) => {
    e.preventDefault();
});
