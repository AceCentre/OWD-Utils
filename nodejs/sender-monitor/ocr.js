const edge = require("electron-edge-js");
const Tesseract = require("tesseract.js");
const path = require("path");
const { app } = require("electron");

const libsPath = app.isPackaged ? path.join(process.resourcesPath, "libs") : path.join(__dirname, "libs");

console.log("Using DLL path:", path.join(libsPath, "System.Runtime.dll"));

const ocrImageEdge = edge.func({
    source: function () {/*
        using System;
        using System.Threading.Tasks;
        using Windows.Graphics.Imaging;
        using Windows.Media.Ocr;
        using Windows.Storage;
        using Windows.Storage.Streams;

        public class Startup
        {
            public async Task<object> Invoke(dynamic input)
            {
                try
                {
                    // Load image file from the provided path
                    string filePath = (string)input;
                    var storageFile = await StorageFile.GetFileFromPathAsync(filePath);

                    using (IRandomAccessStream stream = await storageFile.OpenAsync(FileAccessMode.Read))
                    {
                        var decoder = await BitmapDecoder.CreateAsync(stream);
                        var bitmap = await decoder.GetSoftwareBitmapAsync();

                        // Check if bitmap was successfully created
                        if (bitmap == null) return "Bitmap loading failed";

                        // Create OCR engine and ensure it was initialized
                        var ocrEngine = OcrEngine.TryCreateFromUserProfileLanguages();
                        if (ocrEngine == null) return "OCR Engine creation failed";

                        // Perform OCR and check if result is valid
                        var ocrResult = await ocrEngine.RecognizeAsync(bitmap);
                        if (ocrResult == null || ocrResult.Text == null) return "OCR result is empty or null";

                        return ocrResult.Text;
                    }
                }
                catch (Exception ex)
                {
                    // Return any exception message for debugging
                    return $"Error: {ex.Message}";
                }
            }
        }
    */},
    references: [
        path.join(libsPath, "System.Runtime.dll"),
        path.join(libsPath, "System.Threading.Tasks.dll"),
        path.join(libsPath, "System.Runtime.WindowsRuntime.dll"),
        path.join(libsPath, "Windows.winmd")
    ]
});


// Main OCR function that switches based on config
async function performOCR(filePath, useEdgeForOCR) {
    console.log("performOCR called with useEdgeForOCR:", useEdgeForOCR);

    if (useEdgeForOCR) {
        try {
            const text = await ocrImageEdge(filePath);
            console.log("Recognized text (Windows.Media.Ocr):", text);
            return text || ""; // Return text or an empty string if text is undefined
        } catch (error) {
            console.error("Windows.Media.Ocr failed:", error);
            return null;
        }
    } else {
        try {
            const { data: { text } } = await Tesseract.recognize(filePath, "eng");
            console.log("Recognized text (Tesseract.js):", text);
            return text;
        } catch (error) {
            console.error("Tesseract.js OCR failed:", error);
            return null;
        }
    }
}

module.exports = {
    performOCR
};