
# Clipboard & OCR Text Translator and Sender

This Windows Electron application captures text from either the system clipboard or a defined screen area via OCR (Optical Character Recognition). The app can then translate this text to a target language and send it to a remote display device via WebRTC.

## Features

- **Clipboard Monitoring**: Automatically captures text copied to the clipboard and processes it.
- **Screen OCR Capture**: Defines a screen area to monitor, capturing and processing text via OCR.
- **Language Translation**: Translates captured text from a source to a target language.
- **WebRTC Connectivity**: Sends translated or original text to a paired remote device.
- **QR Code for Easy Pairing**: Displays a QR code for quick connection setup on the remote device.
- **Tray Icon Controls**: Provides easy access to key functions like reconnecting, accessing logs, and viewing session details from the tray icon.

## Setup and Installation

### Prerequisites
- **Node.js**: Ensure you have Node.js installed on your system.
- **Config File**: Customize the configuration in `config.json` for your language preferences and capture settings.

### Installation
1. Clone this repository.
2. Install the dependencies by running:
   ```bash
   npm install
   ```
3. Run the application:
   ```bash
   npm start
   ```

## Configuration

The application uses a `config.json` file, located at:

- **Development**: `./config.json`
- **Production**: `%AppData%/YourAppName/config.json`

This file allows customization of:
- `translation.sourceLang`: Source language for translation.
- `translation.targetLang`: Target language for translation.
- `monitorMode`: `clipboard` for clipboard monitoring or `ocr` for screen OCR.
- `captureArea`: Defines `x`, `y`, `width`, and `height` for OCR screen capture.
- `captureInterval`: Interval (in ms) for capturing and processing content.
- `translation.autoCorrect`: Whether to enable auto-correction on translation.

### Example Configuration

```json
{
    "translation": {
        "enabled": true,
        "sourceLang": "en",
        "targetLang": "es",
        "autoCorrect": false
    },
    "monitorMode": "clipboard",
    "captureArea": {
        "x": 100,
        "y": 100,
        "width": 500,
        "height": 300
    },
    "captureInterval": 5000
}
```

## Tray Menu Options

- **Show QR Code**: Display a QR code for connecting a remote display device.
- **Reconnect**: Attempts to reconnect to the remote device if disconnected.
- **Open Log Directory**: Opens the directory containing log files.
- **Open Config**: Opens the `config.json` file for editing.
- **Copy Session ID**: Copies the session ID to the clipboard for pairing.
- **Quit**: Exits the application.

## Logging

The app generates a `log.txt` file in the application data directory to record events, errors, and connection status.

## Closing the Application

The app prevents all windows from closing by default. To fully quit, use the **Quit** option in the tray menu or force quit the app from the task manager.

## Troubleshooting

- **Translation Issues**: Ensure network connectivity and verify language codes in `config.json`.
- **OCR Failures**: Check screen capture settings, particularly the capture area coordinates and dimensions.

## License

MIT License

---

This project integrates the `google-translate-api-x` for translation and `node-screenshots` for OCR capture.
