// preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("closeQRWindow", () => {
    ipcRenderer.send("close-qr-window");
});