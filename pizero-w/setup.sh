
#!/bin/bash
# Setup script for WebRTC Display App on Raspberry Pi

# Update and install dependencies
sudo apt update
sudo apt install -y git python3-pip
pip3 install papirus

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt install -y nodejs

# Install necessary Node.js packages
cd webrtc_display_app
npm install socket.io-client python-shell wrtc

# Use pm2 for persistent service
sudo npm install -g pm2
pm2 start server.js --name "webrtc-display"
pm2 save
pm2 startup
