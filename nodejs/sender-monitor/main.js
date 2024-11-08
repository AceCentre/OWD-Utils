const { app, Tray, Menu, shell, clipboard, BrowserWindow, ipcMain, screen} = require("electron");
const path = require("path");
const fs = require("fs");
const WebRTCConnection = require("./webrtc");
const QRCode = require("qrcode");
const { Monitor } = require("node-screenshots");
const { performOCR } = require("./ocr");
const { Translator } = require("google-translate-api-x");
const sharp = require("sharp");

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
let overlayWindow = null; 

const logFilePath = path.join(app.getPath("userData"), "log.txt");

const configFilePath = app.isPackaged
    ? path.join(app.getPath("userData"), "config.json")
    : path.join(__dirname, "config.json");

if (app.isPackaged && !fs.existsSync(configFilePath)) {
    fs.copyFileSync(path.join(__dirname, "config.json"), configFilePath);
}

let config = JSON.parse(fs.readFileSync(configFilePath, "utf-8"));
const webrtc = new WebRTCConnection(config);

ipcMain.on("close-qr-window", () => {
    if (qrWindow) {
        qrWindow.close();
    }
});

function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
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
    console.log("Overlay window closed");
  });
}

// Updated `set-capture-area` handler
ipcMain.on("set-capture-area", (event, bounds) => {
  console.log("Received capture area bounds from overlay:", bounds);
  if (!bounds || !bounds.width || !bounds.height) {
    console.error("Invalid capture area bounds received:", bounds);
    return;
  }

  config.captureArea = bounds;
  fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2), "utf-8");
  console.log(`Updated capture area to new values: ${JSON.stringify(bounds)}`);

  // Close the overlay window after capturing bounds
  if (overlayWindow) {
    overlayWindow.close();
  }
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
        if (config.sessionId !== webrtc.sessionId) {
            webrtc.updateConfig(config);
        }
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

        // Update translation settings based on the reloaded config
        const isTranslationEnabled = config.translation?.enabled || false;
        console.log(`Translation enabled: ${isTranslationEnabled}`);
        logMessage(`Translation enabled: ${isTranslationEnabled}`);

    } catch (error) {
        console.error("Failed to reload config:", error);
        logMessage("Failed to reload config.");
    }
}

// Capture and OCR function with return of recognized text
async function captureAndProcessScreen() {
  const { x, y, width, height } = config.captureArea;
  const useEdgeForOCR = config.useEdgeForOCR;
  const fullImagePath = path.join(app.getPath("temp"), "full-image.png");
  const croppedImagePath = path.join(app.getPath("temp"), "cropped-image.png");

  try {
    console.log("Starting screen capture and cropping process...");

    const monitor = Monitor.all().find(m => m.isPrimary);
    if (!monitor) {
      console.error("No primary monitor found.");
      return;
    }

    const fullImage = await monitor.captureImage();
    if (!fullImage) {
      console.error("Image capture failed.");
      return;
    }

    // Convert the full captured image to a PNG buffer
    const fullImageBuffer = await fullImage.toPng().catch(err => {
        console.error("Failed to create fullImageBuffer:", err);
        throw err; 
    });

    // Save the full image
    await fs.promises.writeFile(fullImagePath, fullImageBuffer);
    console.log("Full screenshot saved at", fullImagePath);

    if (!fs.existsSync(fullImagePath)) {
      console.error("Full screenshot file does not exist at", fullImagePath);
      return;
    }

    // Get image dimensions using sharp to verify metadata
    const imageMetadata = await sharp(fullImagePath).metadata();
    console.log("Full image dimensions:", imageMetadata);

    // Get the primary display's scaling factor
    const primaryDisplay = screen.getPrimaryDisplay();
    const scaleFactor = primaryDisplay.scaleFactor;
    console.log("Primary display scale factor:", scaleFactor);

    // Adjust bounds to account for scaling
    const scaledX = Math.round(x * scaleFactor);
    const scaledY = Math.round(y * scaleFactor);
    const scaledWidth = Math.round(width * scaleFactor);
    const scaledHeight = Math.round(height * scaleFactor);

    console.log(`Scaled crop bounds: x=${scaledX}, y=${scaledY}, width=${scaledWidth}, height=${scaledHeight}`);

    // Adjust bounds to ensure they are within the image dimensions
    const adjustedX = Math.min(Math.max(scaledX, 0), imageMetadata.width);
    const adjustedY = Math.min(Math.max(scaledY, 0), imageMetadata.height);
    const adjustedWidth = Math.min(scaledWidth, imageMetadata.width - adjustedX);
    const adjustedHeight = Math.min(scaledHeight, imageMetadata.height - adjustedY);

    console.log(`Adjusted crop bounds for the image: x=${adjustedX}, y=${adjustedY}, width=${adjustedWidth}, height=${adjustedHeight}`);

    // Now proceed to crop the image using sharp with the adjusted dimensions
    await sharp(fullImagePath)
      .extract({ left: adjustedX, top: adjustedY, width: adjustedWidth, height: adjustedHeight })
      .toFile(croppedImagePath);

    console.log("Cropped image successfully saved at", croppedImagePath);

    if (!fs.existsSync(croppedImagePath)) {
      console.error("Cropped image file does not exist at", croppedImagePath);
      return;
    }

    const recognizedText = await performOCR(croppedImagePath, useEdgeForOCR);

    if (recognizedText === undefined) {
      console.log("OCR result was undefined. Opening image directory for inspection...");
    } else {
      console.log("OCR completed, recognized text:", recognizedText);
    }

    return recognizedText || "";
    
  } catch (error) {
    console.error("Error occurred during capture or cropping process:", error);
  } finally {
    // Clean up temporary files if they exist
    if (fs.existsSync(croppedImagePath)) {
      fs.unlinkSync(croppedImagePath);
      console.log("Temporary OCR file cleaned up:", croppedImagePath);
    }

    if (fs.existsSync(fullImagePath)) {
      fs.unlinkSync(fullImagePath);
      console.log("Temporary OCR file cleaned up of screen:", fullImagePath);
    }
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
