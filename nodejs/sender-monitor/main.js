const { app, Tray, Menu, shell, clipboard, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const webrtc = require("./webrtc");
const QRCode = require("qrcode");

let tray;
let qrWindow;
let lastText = "";
let isConnected = false;

const logFilePath = path.join(app.getPath("userData"), "log.txt");

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
        if (err) console.error("Failed to generate QR code:", err);
        else {
            const contextMenu = Menu.buildFromTemplate([
                { label: "Show QR Code", click: () => createQRWindow(url) },
                {
                    label: "Open Log Directory",
                    click: () => shell.showItemInFolder(logFilePath),
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

    setInterval(() => {
        const currentText = clipboard.readText();
        if (currentText && currentText !== lastText) {
            webrtc.sendMessage(currentText);
            lastText = currentText;
            logMessage(`Clipboard changed: ${currentText}`);
        }
    }, 1000);
});


app.on("window-all-closed", (e) => {
    e.preventDefault();
});
