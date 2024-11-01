const { ipcRenderer } = require("electron");

const canvas = document.getElementById("selectionCanvas");
const ctx = canvas.getContext("2d");

// Set canvas dimensions to match the window
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let startX, startY, isDrawing = false;

// Logging function for debugging
function logMessage(message) {
    console.log(`[Overlay] ${message}`);
}

canvas.addEventListener("mousedown", (e) => {
    logMessage("Mouse down event detected.");
    startX = e.clientX;
    startY = e.clientY;
    isDrawing = true;
});

canvas.addEventListener("mousemove", (e) => {
    if (!isDrawing) return;
    logMessage(`Mouse move: ${e.clientX}, ${e.clientY}`);

    // Clear the canvas before drawing a new rectangle
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const width = e.clientX - startX;
    const height = e.clientY - startY;

    // Draw the rectangle
    ctx.strokeStyle = "red";
    ctx.lineWidth = 2;
    ctx.strokeRect(startX, startY, width, height);
});

canvas.addEventListener("mouseup", (e) => {
    logMessage("Mouse up event detected.");
    if (!isDrawing) return;
    isDrawing = false;

    const width = e.clientX - startX;
    const height = e.clientY - startY;

    // Log the final rectangle coordinates for debugging
    logMessage(`Final rectangle: x=${startX}, y=${startY}, width=${width}, height=${height}`);

    // Send the coordinates to the main process
    ipcRenderer.send("set-ocr-boundaries", { x: startX, y: startY, width, height });
    window.close();
});

// Ensure the canvas resizes correctly if the window size changes
window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    logMessage("Canvas resized to fit window.");
});