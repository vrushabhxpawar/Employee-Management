// src/services/employee.service.js
import axios from "axios";
import { isOnline } from "../utils/network";

const API_URL = "/api/employees";
const CACHE_KEY = "cachedEmployees";

export const EmployeeService = {
  async getEmployees() {
    // 1️⃣ Always try cache first (instant UI)
    const cached = this.getCachedEmployees();

    // 2️⃣ If offline, cache is the only source of truth
    if (!isOnline()) {
      return cached;
    }

    // 3️⃣ Online → return cache immediately, refresh in background
    try {
      const res = await axios.get(API_URL);
      const data = res.data.data || res.data;

      this.setCachedEmployees(data);
      return data;
    } catch {
      // Network failed but user is technically online
      return cached;
    }
  },

  getCachedEmployees() {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  },

  setCachedEmployees(data) {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  },

  clearCache() {
    localStorage.removeItem(CACHE_KEY);
  },
};
