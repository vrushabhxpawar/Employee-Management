import Employee from "../models/employee.js";
import asyncHandler from "../middlewares/asyncHandler.js";

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidPhone = (phone) => /^[0-9]{10}$/.test(phone);

export const createEmployee = asyncHandler(async (req, res) => {
  const { name, email, phone } = req.body;

  if (!name || !email || !phone) {
    return res
      .status(400)
      .json({ success: false, message: "All fields required" });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, message: "Invalid email" });
  }

  if (!isValidPhone(phone)) {
    return res.status(400).json({ success: false, message: "Invalid phone" });
  }

  const exists = await Employee.findOne({ email });
  if (exists) {
    return res
      .status(409)
      .json({ success: false, message: "Email already exists" });
  }

  // Store files locally instead of Cloudinary
  let files = [];
  for (const file of req.files) {
    files.push({
      url: `${req.protocol}://${req.get("host")}/uploads/${file.filename}`,
      filename: file.filename,
      path: file.path,
    });
  }

  const employee = await Employee.create({
    name,
    email,
    phone,
    files,
  });

  res.status(201).json({ success: true, data: employee });
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
  const { name, email, phone, existingFiles } = req.body;

  if (!name || !email || !phone) {
    return res.status(400).json({
      success: false,
      message: "All fields required",
    });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, message: "Invalid email" });
  }

  if (!isValidPhone(phone)) {
    return res.status(400).json({ success: false, message: "Invalid phone" });
  }

  const employee = await Employee.findById(req.params.id);
  if (!employee) {
    return res.status(404).json({
      success: false,
      message: "Employee not found",
    });
  }

  // Check email uniqueness
  const emailOwner = await Employee.findOne({
    email,
    _id: { $ne: req.params.id },
  });
  if (emailOwner) {
    return res.status(409).json({
      success: false,
      message: "Email already exists",
    });
  }

  /* ================= PARSE FILES TO KEEP ================= */
  let filesToKeep = [];
  if (existingFiles) {
    try {
      filesToKeep = JSON.parse(existingFiles);
    } catch {
      filesToKeep = [];
    }
  }

  /* ================= DELETE REMOVED FILES ================= */
  const filesToDelete = employee.files.filter(
    (file) => !filesToKeep.some((keep) => keep.filename === file.filename)
  );

  for (const file of filesToDelete) {
    try {
      const filePath = path.join(process.cwd(), file.path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.error("Error deleting file:", err.message);
    }
  }

  /* ================= ADD NEW FILES ================= */
  let updatedFiles = [...filesToKeep];

  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      updatedFiles.push({
        url: `${req.protocol}://${req.get("host")}/uploads/${file.filename}`,
        filename: file.filename,
        path: `uploads/${file.filename}`,
      });
    }
  }

  /* ================= UPDATE EMPLOYEE ================= */
  employee.name = name;
  employee.email = email;
  employee.phone = phone;
  employee.files = updatedFiles;

  await employee.save();

  res.status(200).json({
    success: true,
    data: employee,
  });
});



const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FS = fs.promises;
export const deleteEmployee = asyncHandler(async (req, res) => {
  const employee = await Employee.findById(req.params.id);
  
  if (!employee) {
    return res.status(404).json({ success: false, message: "Employee not found" });
  }

  // Delete files
  if (employee.files && employee.files.length > 0) {
    for (const file of employee.files) {
      try {
        const filename = file.url.split('/').pop();
        // Use process.cwd() to get project root, then navigate to uploads
        const filePath = path.join(process.cwd(), 'uploads', filename);
        console.log(`Attempting to delete: ${filePath}`);
        await FS.unlink(filePath);
        console.log(`Deleted file: ${filename}`);
      } catch (fileError) {
        console.error(`Error deleting file:`, fileError.message);
      }
    }
  }

  await employee.deleteOne();

  res.status(200).json({
    success: true,
    message: "Employee deleted successfully",
  });
});
