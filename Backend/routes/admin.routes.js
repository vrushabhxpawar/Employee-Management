import express from "express";
import FeatureFlag from "../models/featureFlag.model.js";
import BillIndex from "../models/billIndex.model.js";
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

/* ================= OCR QUOTA (FREE + PAID) ================= */

// Get current OCR quota status
router.get(
  "/ocr-quota",
  asyncHandler(async (req, res) => {
    const paidEnabled = await isPaidOCRAllowed();
    const quota = await checkOCRLimit(new Date(), paidEnabled);

    res.json({
      month: quota.month,
      mode: quota.mode,
      allowed: quota.allowed,
      exhausted: quota.exhausted ?? false,
      used: quota.used ?? 0,
      limit: quota.limit ?? 1000,
      remaining: quota.remaining ?? 0,
      paidUsed: quota.used ?? 0,
      totalPaid: quota?.totalPaid ?? 0,
      pricePerRequest: quota.pricePerRequest ?? 0,
      resetAt: quota.resetAt,
    });
  })
);

/* ================= PDF OCR JOB STATUS ================= */

/**
 * GET /ocr-job/:jobId
 * Returns processing status of a PDF OCR job
 */
router.get(
  "/ocr-job/:jobId",
  asyncHandler(async (req, res) => {
    const { jobId } = req.params;

    const job = await BillIndex.findById(jobId).select(
      "status error createdAt updatedAt"
    );

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "OCR job not found",
      });
    }

    return res.json({
      success: true,
      jobId: job._id,
      status: job.status,
      error: job.error || null,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    });
  })
);

export default router;
