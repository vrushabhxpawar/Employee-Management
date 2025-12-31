import fs from "fs";

export const ensureFileExists = (filePath) => {
  if (!fs.existsSync(filePath)) {
    throw new Error("File not found");
  }
};
