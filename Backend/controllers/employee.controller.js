import Employee from "../models/employee.js";
import asyncHandler from "../middlewares/asyncHandler.js";


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
      url: `${req.protocol}://${req.get('host')}/uploads/${file.filename}`,
      filename: file.filename,
      path: file.path
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

  // Parse existing files to keep
  let filesToKeep = [];
  if (existingFiles) {
    try {
      filesToKeep = JSON.parse(existingFiles);
    } catch (e) {
      filesToKeep = [];
    }
  }

  // Delete removed files from Cloudinary
  const filesToDelete = employee.files.filter(
    (file) => !filesToKeep.some((kept) => kept.publicId === file.publicId)
  );

  for (const file of filesToDelete) {
    try {
      await cloudinary.uploader.destroy(file.publicId);
    } catch (error) {
      console.error("Error deleting file from cloudinary:", error);
    }
  }

  // Start with files to keep
  let updatedFiles = [...filesToKeep];

  // Add new uploaded files
  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      const uploaded = await uploadOnCloudinary(file.path);
      if (uploaded) {
        updatedFiles.push({
          url: uploaded.secure_url,
          publicId: uploaded.public_id,
        });
      }
    }
  }

  employee.name = name;
  employee.email = email;
  employee.phone = phone;
  employee.files = updatedFiles;

  await employee.save();

  res.status(200).json({ success: true, data: employee });
});

export const deleteEmployee = asyncHandler(async (req, res) => {
  const employee = await Employee.findById(req.params.id);
  if (!employee) {
    return res
      .status(404)
      .json({ success: false, message: "Employee not found" });
  }

  await employee.deleteOne();

  res.status(200).json({
    success: true,
    message: "Employee deleted successfully",
  });
});
