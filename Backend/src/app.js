import dotenv from "dotenv";
dotenv.config();

import express from "express";
import connectDB from "../DB/connectDB.js";
import employeeRoutes from "../routes/employee.routes.js";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static("uploads"));
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);
app.use("/api/employees", employeeRoutes);

connectDB();
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
