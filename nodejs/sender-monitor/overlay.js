// overlay.js

const canvas = document.getElementById("selectionCanvas");
const ctx = canvas.getContext("2d");

// Set canvas dimensions to match the window
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let startX, startY, isDrawing = false;

canvas.addEventListener("mousedown", (e) => {
    startX = e.clientX;
    startY = e.clientY;
    isDrawing = true;
});

canvas.addEventListener("mousemove", (e) => {
    if (!isDrawing) return;

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
    if (!isDrawing) return;
    isDrawing = false;

    const width = e.clientX - startX;
    const height = e.clientY - startY;

    // Send the coordinates to the main process via electronAPI
    window.electronAPI.sendOCRBounds({ x: startX, y: startY, width, height });

    // Close the overlay window after sending the data
    window.close();
});

// Ensure the canvas resizes correctly if the window size changes
window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});