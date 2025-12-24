// backend/util/cloudinary.js
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

export const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;

    cloudinary.config({
      cloud_name: process.env.CLOUD_NAME,
      api_key: process.env.CLOUD_API_KEY,
      api_secret: process.env.CLOUD_API_SECRET,
    });

    const normalizedPath = localFilePath.replace(/\\/g, "/");

    const response = await cloudinary.uploader.upload(normalizedPath, {
      resource_type: "auto",
    });
    console.log(response)

    await fs.promises.unlink(normalizedPath);
    return response;
  } catch (error) {
    console.error("❌ Cloudinary upload failed:", error);
    return null;
  }
};
