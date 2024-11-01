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
                    string filePath = (string)input;
                    var storageFile = await StorageFile.GetFileFromPathAsync(filePath);

                    using (IRandomAccessStream stream = await storageFile.OpenAsync(FileAccessMode.Read))
                    {
                        var decoder = await BitmapDecoder.CreateAsync(stream);
                        var bitmap = await decoder.GetSoftwareBitmapAsync();

                        if (bitmap == null) return "Bitmap loading failed";

                        var ocrEngine = OcrEngine.TryCreateFromUserProfileLanguages();
                        if (ocrEngine == null) return "OCR Engine creation failed";

                        var ocrResult = await ocrEngine.RecognizeAsync(bitmap);
                        if (ocrResult == null || ocrResult.Text == null) return "OCR result is empty or null";

                        return ocrResult.Text;
                    }
                }
                catch (Exception ex)
                {
                    return "Error: " + ex.Message;
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
                    string filePath = (string)input;
                    var storageFile = await StorageFile.GetFileFromPathAsync(filePath);

                    // Confirm if the file exists and is accessible
                    if (storageFile == null)
                    {
                        return "Error: Unable to access file at path: " + filePath;
                    }

                    using (IRandomAccessStream stream = await storageFile.OpenAsync(FileAccessMode.Read))
                    {
                        var decoder = await BitmapDecoder.CreateAsync(stream);
                        var bitmap = await decoder.GetSoftwareBitmapAsync();

                        // Confirm if bitmap is loaded
                        if (bitmap == null)
                        {
                            return "Error: Failed to load bitmap from file.";
                        }

                        var ocrEngine = OcrEngine.TryCreateFromUserProfileLanguages();
                        if (ocrEngine == null)
                        {
                            return "Error: OCR Engine creation failed.";
                        }

                        var ocrResult = await ocrEngine.RecognizeAsync(bitmap);

                        // Check if OCR result is null or empty
                        if (ocrResult == null || ocrResult.Text == null)
                        {
                            return "Error: OCR processing resulted in an empty or null text.";
                        }

                        return ocrResult.Text;
                    }
                }
                catch (Exception ex)
                {
                    // Return any exception message for debugging
                    return "Error: " + ex.Message;
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

module.exports = {
    performOCR
};