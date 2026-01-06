import path from "path";
import vision from "@google-cloud/vision";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const visionClient = new vision.ImageAnnotatorClient({
  keyFilename: path.join(__dirname, "..", "keys", "google-vision.json"),
});
