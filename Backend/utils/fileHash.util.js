import crypto from "crypto";
import fs from "fs";

export const generateFileHash = (filePath) => {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
};
