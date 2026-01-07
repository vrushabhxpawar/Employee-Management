import Employee from "../models/employee.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import { generateFileHash } from "../utils/fileHash.util.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import BillIndex from "../models/billIndex.model.js";
import { extractTextFromPDF } from "../services/pdf/pdfText.service.js";
import { extractTextFromImage } from "../services/vision/visionText.service.js";
import { extractBillNumber, extractTotalAmount } from "../parsers/index.js";
import { extractBillsFromFile } from "../services/extraction/extractBillFromFile.js";
import { isOCRServiceEnabled } from "../services/featureFlag.service.js";
import { assertOCRAllowed } from "../services/ocr/ocrGate.service.js";
import { incrementOCRUsage } from "../services/ocr/ocrLimit.service.js";

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidPhone = (phone) => /^[0-9]{10}$/.test(phone);

const buildBillKey = (billNo, amount) =>
  `${billNo.trim().toLowerCase()}_${amount}`;

export const createEmployee = asyncHandler(async (req, res) => {
  const { name, email, phone } = req.body;

  if (!name || !email || !phone)
    return res
      .status(400)
      .json({ success: false, message: "All fields required" });

  if (!isValidEmail(email))
    return res.status(400).json({ success: false, message: "Invalid email" });

  if (!isValidPhone(phone))
    return res.status(400).json({ success: false, message: "Invalid phone" });

  if (!req.files || req.files.length === 0)
    return res
      .status(400)
      .json({ success: false, message: "At least one file required" });

  const existingEmail = await Employee.findOne({ email });
  if (existingEmail) {
    res.status(400).json({ message: "Email already exists" });
  }

  /* ================= HELPERS ================= */
  const cleanupFiles = () => {
    req.files.forEach((f) => {
      const p = path.resolve(f.path);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });
  };

  const buildBillKey = (billNo, amount) =>
    `${billNo.trim().toLowerCase()}_${amount}`;

  /* ================= PHASE 1: VALIDATE (NO DB WRITES) ================= */
  const seenFileHashes = new Set();
  const seenBillKeys = new Set();
  const validatedFiles = [];

  try {
    const ocr = await assertOCRAllowed();
    for (const file of req.files) {
      const absolutePath = path.resolve(file.path);
      const fileHash = generateFileHash(absolutePath);

      // same-upload file duplicate
      if (seenFileHashes.has(fileHash)) {
        cleanupFiles();
        return res.status(409).json({
          success: false,
          message: "Duplicate file in same upload",
        });
      }
      seenFileHashes.add(fileHash);

      // OCR + parse ONCE
      const extractedBills = await extractBillsFromFile(
        absolutePath,
        file.mimetype
      );

      const validBills = extractedBills.filter(
        (b) => b.billNo && b.amount && b.amount > 0
      );

      if (validBills.length === 0) {
        cleanupFiles();
        return res.status(400).json({
          success: false,
          message: "No valid bills found in uploaded PDF",
        });
      }

      for (const bill of extractedBills) {
        if (!bill.billNo || !bill.amount) continue;

        const billKey = buildBillKey(bill.billNo, bill.amount);

        // duplicate inside same request (multi-bill PDF)
        if (seenBillKeys.has(billKey)) {
          cleanupFiles();
          return res.status(409).json({
            success: false,
            message: `Duplicate bill in same upload (Bill No: ${bill.billNo})`,
          });
        }
        seenBillKeys.add(billKey);

        // global duplicate (image vs pdf, pdf vs pdf, etc)
        const billExists = await BillIndex.findOne({ billKey }).populate(
          "sourceEmployee",
          "name"
        );

        if (billExists) {
          cleanupFiles();
          return res.status(409).json({
            success: false,
            duplicate: true,
            message: "Duplicate bill detected",
            duplicateInfo: {
              billNumber: bill.billNo,
              amount: bill.amount,
              uploadedBy: billExists.sourceEmployee?.name,
              uploadedAt: billExists.createdAt,
              sourceFile: billExists.sourceFile,
            },
          });
        }
      }

      validatedFiles.push({
        file,
        fileHash,
        extractedBills,
      });
    }

    /* ================= PHASE 2: SAVE (ALL SAFE) ================= */
    const employee = await Employee.create({
      name,
      email,
      phone,
      files: validatedFiles.map((v) => ({
        url: `${req.protocol}://${req.get("host")}/uploads/${v.file.filename}`,
        filename: v.file.filename,
        path: v.file.path,
        fileHash: v.fileHash,
        extractedBills: v.extractedBills,
      })),
    });

    // index bills AFTER employee exists
    for (const v of validatedFiles) {
      for (const bill of v.extractedBills) {
        if (!bill.billNo || !bill.amount) continue;

        await BillIndex.create({
          billKey: buildBillKey(bill.billNo, bill.amount),
          billNumber: bill.billNo.trim(),
          amount: bill.amount,
          sourceEmployee: employee._id,
          sourceFile: v.file.filename,
        });
      }
    }

    return res.status(201).json({
      success: true,
      message: "Employee created successfully",
      data: employee,
    });
  } catch (err) {
    // Always cleanup uploaded files first
    cleanupFiles();

    console.error("Create employee failed:", err);

    // OCR quota exceeded
    if (err.statusCode === 429) {
      return res.status(429).json({
        success: false,
        message: err.message,
      });
    }

    // Duplicate / validation errors
    if (err.statusCode === 409) {
      return res.status(409).json({
        success: false,
        message: err.message,
      });
    }

    // Default server error
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to create employee",
    });
  }
});

export const getEmployees = asyncHandler(async (req, res) => {
  const employees = await Employee.find().sort({ createdAt: -1 });
  res.status(200).json({ success: true, data: employees });
});

export const getEmployeeById = asyncHandler(async (req, res) => {
  const employee = await Employee.findById(req.params.id);
  if (!employee) {
    return res
      .status(404)
      .json({ success: false, message: "Employee not found" });
  }
  res.status(200).json({ success: true, data: employee });
});

export const updateEmployee = asyncHandler(async (req, res) => {
  try {
    const { name, email, phone, existingFiles } = req.body;

    /* ================= VALIDATION ================= */
    if (!name || !email || !phone)
      return res.status(400).json({
        success: false,
        message: "All fields required",
      });

    if (!isValidEmail(email))
      return res.status(400).json({
        success: false,
        message: "Invalid email",
      });

    if (!isValidPhone(phone))
      return res.status(400).json({
        success: false,
        message: "Invalid phone",
      });

    const employee = await Employee.findById(req.params.id);
    if (!employee)
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });

    const emailOwner = await Employee.findOne({
      email,
      _id: { $ne: employee._id },
    });
    if (emailOwner)
      return res.status(409).json({
        success: false,
        message: "Email already exists",
      });

    /* ================= FILES TO KEEP ================= */
    let filesToKeep = [];
    if (existingFiles) {
      try {
        filesToKeep = JSON.parse(existingFiles);
      } catch {
        filesToKeep = [];
      }
    }

    /* ================= REMOVE FILES ================= */
    const removedFiles = employee.files.filter(
      (f) => !filesToKeep.some((k) => k.filename === f.filename)
    );

    for (const file of removedFiles) {
      const absPath = path.join(process.cwd(), file.path);
      if (fs.existsSync(absPath)) fs.unlinkSync(absPath);

      await BillIndex.deleteMany({
        sourceEmployee: employee._id,
        sourceFile: file.filename,
      });
    }

    /* ================= PROCESS NEW FILES ================= */
    const updatedFiles = [...filesToKeep];
    const billsToIndex = [];
    const seenFileHashes = new Set();
    const seenBillKeys = new Set();

    if (req.files?.length) {
      for (const file of req.files) {
        const absPath = path.resolve(file.path);
        const fileHash = generateFileHash(absPath);

        /* ---------- SAME UPDATE DUPLICATE FILE ---------- */
        if (seenFileHashes.has(fileHash)) {
          fs.unlinkSync(absPath);
          return res.status(409).json({
            success: false,
            message: "Duplicate file in same update",
          });
        }
        seenFileHashes.add(fileHash);

        /* ---------- GLOBAL FILE DUPLICATE ---------- */
        const fileExists = await Employee.findOne({
          "files.fileHash": fileHash,
          _id: { $ne: employee._id },
        });
        if (fileExists) {
          fs.unlinkSync(absPath);
          return res.status(409).json({
            success: false,
            message: "This document already exists in system",
          });
        }

        /* ---------- OCR + PARSE ---------- */
        const extractedBills = await extractBillsFromFile(
          absPath,
          file.mimetype
        );

        for (const bill of extractedBills) {
          if (!bill.billNo || !bill.amount) continue;

          const billKey = buildBillKey(bill.billNo, bill.amount);

          /* ----- SAME UPDATE DUPLICATE BILL ----- */
          if (seenBillKeys.has(billKey)) {
            fs.unlinkSync(absPath);
            return res.status(409).json({
              success: false,
              message: `Duplicate bill in upload (Bill No: ${bill.billNo})`,
            });
          }
          seenBillKeys.add(billKey);

          /* ----- GLOBAL DUPLICATE BILL ----- */
          const exists = await BillIndex.findOne({ billKey });
          if (exists) {
            fs.unlinkSync(absPath);
            return res.status(409).json({
              success: false,
              message: `Duplicate bill detected (Bill No: ${bill.billNo})`,
            });
          }

          billsToIndex.push({
            billKey,
            billNumber: bill.billNo.trim(),
            amount: bill.amount,
            sourceFile: file.filename,
          });
        }

        updatedFiles.push({
          url: `${req.protocol}://${req.get("host")}/uploads/${file.filename}`,
          filename: file.filename,
          path: file.path,
          fileHash,
        });
      }
    }

    /* ================= SAVE EMPLOYEE ================= */
    employee.name = name;
    employee.email = email;
    employee.phone = phone;
    employee.files = updatedFiles;
    await employee.save();

    /* ================= INDEX BILLS ================= */
    for (const bill of billsToIndex) {
      await BillIndex.create({
        ...bill,
        sourceEmployee: employee._id,
      });
    }

    res.status(200).json({
      success: true,
      message: "Employee updated successfully",
      data: employee,
    });
  } catch (err) {
    // 🧹 Cleanup newly uploaded files
    if (req.files?.length) {
      for (const file of req.files) {
        const absPath = path.resolve(file.path);
        if (fs.existsSync(absPath)) {
          try {
            fs.unlinkSync(absPath);
          } catch (e) {
            console.error("Cleanup failed:", absPath, e);
          }
        }
      }
    }

    console.error("Update employee failed:", err);

    // OCR quota exceeded
    if (err.statusCode === 429) {
      return res.status(429).json({
        success: false,
        message: err.message,
      });
    }

    // Duplicate bill / duplicate file
    if (err.statusCode === 409) {
      return res.status(409).json({
        success: false,
        message: err.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to update employee",
    });
  }
});

const FS = fs.promises;
export const deleteEmployee = asyncHandler(async (req, res) => {
  const employee = await Employee.findById(req.params.id);

  if (!employee) {
    return res
      .status(404)
      .json({ success: false, message: "Employee not found" });
  }

  // Delete files
  if (employee.files && employee.files.length > 0) {
    for (const file of employee.files) {
      try {
        const filename = file.url.split("/").pop();
        // Use process.cwd() to get project root, then navigate to uploads
        const filePath = path.join(process.cwd(), "uploads", filename);
        console.log(`Attempting to delete: ${filePath}`);
        await FS.unlink(filePath);
        console.log(`Deleted file: ${filename}`);
      } catch (fileError) {
        console.error(`Error deleting file:`, fileError.message);
      }
    }
  }
  await BillIndex.deleteMany({
    sourceEmployee: employee._id,
  });

  await employee.deleteOne();

  res.status(200).json({
    success: true,
    message: "Employee deleted successfully",
  });
});
