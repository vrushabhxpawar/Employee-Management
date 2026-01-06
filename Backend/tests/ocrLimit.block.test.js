import { checkOCRLimit } from "../services/ocr/ocrLimit.service.js";
import OCRUsage from "../models/ocrUsage.model.js";

describe("OCR monthly limit", () => {
  it("blocks after limit is reached", async () => {
    // Seed exhausted usage for current month
    const now = new Date();
    const month = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}`;

    await OCRUsage.create({
      month,
      count: 1000,
      limit: 1000,
    });

    const res = await checkOCRLimit();

    expect(res.allowed).toBe(false);
    expect(res.remaining).toBe(0);
  });
});
