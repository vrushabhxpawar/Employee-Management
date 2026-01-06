import dotenv from "dotenv";
dotenv.config();

import express from "express";
import connectDB from "../DB/connectDB.js";
import employeeRoutes from "../routes/employee.routes.js";
import adminRoutes from "../routes/admin.routes.js";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static("uploads"));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);
app.use("/api/employees", employeeRoutes);
app.use("/api/admin" , adminRoutes);


connectDB();
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
