// overlay-preload.js

const { contextBridge, ipcRenderer } = require("electron");

// Expose only the necessary Electron APIs to the renderer
contextBridge.exposeInMainWorld("electronAPI", {
    sendOCRBounds: (bounds) => ipcRenderer.send("set-ocr-boundaries", bounds)
});