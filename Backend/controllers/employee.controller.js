import Employee from "../models/employee.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import { uploadOnCloudinary } from "../util/cloudinary.js";
import { v2 as cloudinary } from "cloudinary";

/* helpers */
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidPhone = (phone) => /^[0-9]{10}$/.test(phone);

/* ================= CREATE ================= */
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

  let files = [];
  console.log(req.files);
  for (const file of req.files) {
    const uploaded = await uploadOnCloudinary(file.path);
    console.log(uploaded);
    if (uploaded) {
      files.push({
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
      });
    }
  }

  const employee = await Employee.create({
    name,
    email,
    phone,
    files,
  });

  res.status(201).json({ success: true, data: employee });
});

/* ================= READ ALL ================= */
export const getEmployees = asyncHandler(async (req, res) => {
  const employees = await Employee.find().sort({ createdAt: -1 });
  res.status(200).json({ success: true, data: employees });
});

/* ================= READ ONE ================= */
export const getEmployeeById = asyncHandler(async (req, res) => {
  const employee = await Employee.findById(req.params.id);
  if (!employee) {
    return res
      .status(404)
      .json({ success: false, message: "Employee not found" });
  }
  res.status(200).json({ success: true, data: employee });
});

/* ================= UPDATE ================= */
export const updateEmployee = asyncHandler(async (req, res) => {
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

  const employee = await Employee.findById(req.params.id);
  if (!employee) {
    return res
      .status(404)
      .json({ success: false, message: "Employee not found" });
  }

  const emailOwner = await Employee.findOne({
    email,
    _id: { $ne: req.params.id },
  });
  if (emailOwner) {
    return res
      .status(409)
      .json({ success: false, message: "Email already exists" });
  }

  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      const uploaded = await uploadOnCloudinary(file.path);
      if (uploaded) {
        employee.files.push({
          url: uploaded.secure_url,
          publicId: uploaded.public_id,
        });
      }
    }
  }

  employee.name = name;
  employee.email = email;
  employee.phone = phone;

  await employee.save();

  res.status(200).json({ success: true, data: employee });
});

/* ================= DELETE ================= */
export const deleteEmployee = asyncHandler(async (req, res) => {
  const employee = await Employee.findById(req.params.id);
  if (!employee) {
    return res
      .status(404)
      .json({ success: false, message: "Employee not found" });
  }

  if (Array.isArray(employee.files)) {
    for (const file of employee.files) {
      if (file.publicId) {
        await cloudinary.uploader.destroy(file.publicId, {
          resource_type: "auto",
        });
      }
    }
  }

  await employee.deleteOne();

  res.status(200).json({
    success: true,
    message: "Employee deleted successfully",
  });
});
