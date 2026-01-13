// services/employee.service.js
import axios from "axios";
import {
  getCachedEmployees,
  setCachedEmployees,
  addToQueue,
} from "./cache/indexedDb.js";

const API_BASE = import.meta.env.VITE_API_URL;
const API_URL = `${API_BASE}/api/employees`;

export const EmployeeService = {
  /* ================= READ ================= */

  async getEmployees() {
    const cached = await getCachedEmployees();

    if (!navigator.onLine) {
      return Array.isArray(cached) ? cached : [];
    }

    try {
      const res = await axios.get(API_URL);
      const data = Array.isArray(res.data.data)
        ? res.data.data
        : Array.isArray(res.data)
        ? res.data
        : [];

      await setCachedEmployees(data);
      return data;
    } catch {
      return Array.isArray(cached) ? cached : [];
    }
  },

  /* ================= CREATE ================= */

  async createEmployee(form) {
    const cached = await getCachedEmployees();
    const tempId = crypto.randomUUID();

    const tempEmployee = {
      _id: tempId,
      name: form.name,
      email: form.email,
      phone: form.phone,
      files: [], // files sync later
      __offline: true,
      createdAt: Date.now(),
    };

    // 1️⃣ Optimistic cache update
    await setCachedEmployees([...(cached || []), tempEmployee]);

    // 2️⃣ Offline → queue intent
    if (!navigator.onLine) {
      await addToQueue({
        id: crypto.randomUUID(),
        entity: "EMPLOYEE",
        action: "CREATE",
        payload: {
          tempId,
          data: {
            name: form.name,
            email: form.email,
            phone: form.phone,
          },
        },
        createdAt: Date.now(),
      });

      return { offline: true };
    }

    // 3️⃣ Online → normal create
    const res = await axios.post(API_URL, form);
    return res.data;
  },

  /* ================= UPDATE ================= */

  async updateEmployee(id, form) {
    // 1️⃣ Read cached employees
    const cached = await getCachedEmployees();
    console.log(cached)
    const safeCached = Array.isArray(cached) ? cached : [];

    // 2️⃣ Optimistic cache update (THIS FIXES THE LOADING ISSUE)
    const updatedCache = safeCached.map((emp) =>
      emp._id === id
        ? {
            ...emp,
            name: form.name,
            email: form.email,
            phone: form.phone,
            __offline: true, // mark as pending sync
            updatedAt: Date.now(),
          }
        : emp
    );

    await setCachedEmployees(updatedCache);

    // 3️⃣ If OFFLINE → queue update intent (JSON ONLY)
    if (!navigator.onLine) {
      await addToQueue({
        id: crypto.randomUUID(),
        entity: "EMPLOYEE",
        action: "UPDATE",
        payload: {
          id,
          data: {
            name: form.name,
            email: form.email,
            phone: form.phone,
          },
        },
        createdAt: Date.now(),
      });

      // 🔥 IMPORTANT: return immediately so UI stops loading
      return { offline: true };
    }

    // 4️⃣ If ONLINE → normal API update
    const res = await axios.put(`${API_URL}/${id}`, form);

    return res.data;
  },

  /* ================= DELETE ================= */

  async deleteEmployee(id) {
    // Optimistic cache update
    const cached = await getCachedEmployees();
    await setCachedEmployees(
      Array.isArray(cached) ? cached.filter((e) => e._id !== id) : []
    );

    if (!navigator.onLine) {
      await addToQueue({
        id: crypto.randomUUID(),
        entity: "EMPLOYEE",
        action: "DELETE",
        payload: { id },
        createdAt: Date.now(),
      });

      return { offline: true };
    }

    await axios.delete(`${API_URL}/${id}`);
    return { offline: false };
  },
};
