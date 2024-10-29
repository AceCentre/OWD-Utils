const edge = require("electron-edge-js");
const Tesseract = require("tesseract.js");
const path = require("path");

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
                string filePath = (string)input;
                var storageFile = await StorageFile.GetFileFromPathAsync(filePath);

                using (IRandomAccessStream stream = await storageFile.OpenAsync(FileAccessMode.Read))
                {
                    var decoder = await BitmapDecoder.CreateAsync(stream);
                    var bitmap = await decoder.GetSoftwareBitmapAsync();

                    var ocrEngine = OcrEngine.TryCreateFromUserProfileLanguages();
                    var ocrResult = await ocrEngine.RecognizeAsync(bitmap);

                    return ocrResult.Text;
                }
            }
        }
    */},
    references: [
        "System.Runtime.dll",
        "System.Threading.Tasks.dll",
        path.join(__dirname, "libs/System.Runtime.WindowsRuntime.dll"),
        path.join(__dirname, "libs/Windows.winmd")
    ]
});

// Main OCR function that switches based on config
async function performOCR(filePath, useEdgeForOCR) {
    if (useEdgeForOCR) {
        try {
            const text = await ocrImageEdge(filePath);
            console.log("Recognized text (Windows.Media.Ocr):", text);
            return text;
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