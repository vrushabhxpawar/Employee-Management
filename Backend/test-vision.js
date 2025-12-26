import vision from "@google-cloud/vision";
import dotenv from "dotenv";
dotenv.config();

console.log(process.env.GOOGLE_APPLICATION_CREDENTIALS);

async function testVision() {
  try {
    const client = new vision.ImageAnnotatorClient();

    const [result] = await client.textDetection(
      "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/640px-PNG_transparency_demonstration_1.png"
    );

    console.log("✅ Google Vision connected successfully");
    console.log("Detected text:", result.textAnnotations?.[0]?.description || "No text");
  } catch (err) {
    console.error("❌ Google Vision connection failed");
    console.error(err.message);
  }
}

testVision();
