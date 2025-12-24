import express from "express";
import {upload} from "../middlewares/upload.js";
import {
  createEmployee,
  getEmployees,
  updateEmployee,
  deleteEmployee,
  getEmployeeById,
} from "../controllers/employee.controller.js";

const router = express.Router();

router.get("/", getEmployees);
router.get("/:id", getEmployeeById);
router.post("/", upload.array("files", 5), createEmployee);
router.put("/:id", upload.array("files", 5), updateEmployee);

router.delete("/:id", deleteEmployee);

export default router;
