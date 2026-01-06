import express from "express";
import FeatureFlag from "../models/featureFlag.model.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import { isPaidOCRAllowed } from "../services/featureFlag.service.js";
import { checkOCRLimit } from "../services/ocr/ocrLimit.service.js";

const router = express.Router();

/* ================= OCR SERVICE (ADMIN) ================= */

// Get OCR service status
router.get(
  "/ocr-status",
  asyncHandler(async (req, res) => {
    const flag = await FeatureFlag.findOne({ key: "OCR_SERVICE" });
    res.json({
      enabled: flag ? flag.enabled : true,
    });
  })
);

// Toggle OCR service
router.post(
  "/ocr-toggle",
  asyncHandler(async (req, res) => {
    const { enabled } = req.body;

    const flag = await FeatureFlag.findOneAndUpdate(
      { key: "OCR_SERVICE" },
      { enabled: Boolean(enabled) },
      { upsert: true, new: true }
    );

    res.json({
      enabled: flag.enabled,
      message: `OCR service ${flag.enabled ? "enabled" : "disabled"}`,
    });
  })
);

/* ================= PAID OCR (USER CONSENT) ================= */

// Get paid OCR consent status
router.get(
  "/ocr-paid-status",
  asyncHandler(async (req, res) => {
    const enabled = await isPaidOCRAllowed();
    res.json({ enabled });
  })
);

// Toggle paid OCR consent
router.post(
  "/ocr-toggle-paid",
  asyncHandler(async (req, res) => {
    const { enabled } = req.body;

    const flag = await FeatureFlag.findOneAndUpdate(
      { key: "OCR_PAID_CONSENT" },
      { enabled: Boolean(enabled) },
      { upsert: true, new: true }
    );

    res.json({
      enabled: flag.enabled,
    });
  })
);

/* ================= OCR QUOTA (FREE TIER) ================= */

// Get current OCR quota status
router.get(
  "/ocr-quota",
  asyncHandler(async (req, res) => {
    const quota = await checkOCRLimit();

    res.json({
      allowed: quota.allowed,
      exhausted: !quota.allowed,
      remaining: quota.remaining ?? 0,
      resetAt: quota.resetAt,
      pricePerRequest: 2, // or from env
    });
  })
);

export default router;
