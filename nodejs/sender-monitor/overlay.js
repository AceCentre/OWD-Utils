const { ipcRenderer } = require("electron");

const canvas = document.getElementById("selectionCanvas");
const ctx = canvas.getContext("2d");

// Ensure canvas dimensions match the window size
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let startX, startY, isDrawing = false;

canvas.addEventListener("mousedown", (e) => {
    // Start drawing
    startX = e.clientX;
    startY = e.clientY;
    isDrawing = true;
});

canvas.addEventListener("mousemove", (e) => {
    // Only draw if the mouse is pressed down
    if (!isDrawing) return;

    // Clear the canvas before redrawing the rectangle
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate width and height from start to current mouse position
    const width = e.clientX - startX;
    const height = e.clientY - startY;

    // Draw the rectangle
    ctx.strokeStyle = "red";
    ctx.lineWidth = 2;
    ctx.strokeRect(startX, startY, width, height);
});

canvas.addEventListener("mouseup", (e) => {
    // Stop drawing
    if (!isDrawing) return;
    isDrawing = false;

    // Finalize width and height calculations
    const width = e.clientX - startX;
    const height = e.clientY - startY;

    // Send the coordinates to the main process
    ipcRenderer.send("set-ocr-boundaries", { x: startX, y: startY, width, height });

    // Close the window after drawing is complete
    window.close();
});

// Resize the canvas to keep it fullscreen if the window resizes
window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});