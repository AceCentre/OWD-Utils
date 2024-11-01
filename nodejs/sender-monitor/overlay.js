const { ipcRenderer } = require("electron");

const canvas = document.getElementById("selectionCanvas");
const ctx = canvas.getContext("2d");

let startX, startY, isDrawing = false;

canvas.addEventListener("mousedown", (e) => {
    startX = e.clientX;
    startY = e.clientY;
    isDrawing = true;
});

canvas.addEventListener("mousemove", (e) => {
    if (!isDrawing) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const width = e.clientX - startX;
    const height = e.clientY - startY;
    ctx.strokeStyle = "red";
    ctx.lineWidth = 2;
    ctx.strokeRect(startX, startY, width, height);
});

canvas.addEventListener("mouseup", (e) => {
    if (!isDrawing) return;
    isDrawing = false;
    const width = e.clientX - startX;
    const height = e.clientY - startY;

    // Send coordinates to main process and close the overlay
    ipcRenderer.send("set-ocr-boundaries", { x: startX, y: startY, width, height });
    window.close();
});