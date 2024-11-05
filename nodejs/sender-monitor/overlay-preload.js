const { ipcRenderer } = require('electron');

let isSelecting = false;
let startX, startY, endX, endY;

// This listens for the mouse events to capture the coordinates
window.addEventListener('mousedown', (event) => {
  isSelecting = true;
  startX = event.clientX;
  startY = event.clientY;
  console.log('Selection started at:', { x: startX, y: startY });
});

window.addEventListener('mousemove', (event) => {
  if (isSelecting) {
    endX = event.clientX;
    endY = event.clientY;
    console.log('Selection moving:', { endX, endY });
  }
});

window.addEventListener('mouseup', (event) => {
  if (isSelecting) {
    isSelecting = false;
    endX = event.clientX;
    endY = event.clientY;
    console.log('Selection ended at:', { x: endX, y: endY });

    // Calculate the bounds
    const bounds = {
      x: Math.min(startX, endX),
      y: Math.min(startY, endY),
      width: Math.abs(endX - startX),
      height: Math.abs(endY - startY)
    };

    console.log('Bounds calculated:', bounds);

    // Send bounds to the main process
    ipcRenderer.send('set-capture-area', bounds);
  }
});
