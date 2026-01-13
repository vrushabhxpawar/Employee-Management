// services/ocr.service.js
import axios from "axios";
import {
  getCachedOCRState,
  setCachedOCRState,
} from "./cache/indexedDb.js";

const API_BASE = import.meta.env.VITE_API_URL;

export const OCRService = {
  async getOCRState() {
    const cached = await getCachedOCRState();

    if (!navigator.onLine) {
      return cached;
    }

    try {
      const [quotaRes, paidRes] = await Promise.all([
        axios.get(`${API_BASE}/api/admin/ocr-quota`),
        axios.get(`${API_BASE}/api/admin/ocr-paid-status`),
      ]);

      const normalized = {
        quota: quotaRes.data,
        paidEnabled: paidRes.data.enabled,
        cost: Number(quotaRes.data.totalPaid || 0).toFixed(2),
      };

      await setCachedOCRState(normalized);
      return normalized;
    } catch {
      return cached;
    }
  },

  async togglePaidOCR(enabled) {
    if (!navigator.onLine) {
      throw new Error("Internet required to toggle OCR");
    }

    const res = await axios.post(
      `${API_BASE}/api/admin/ocr-toggle-paid`,
      { enabled }
    );

    const cached = (await getCachedOCRState()) || {};
    await setCachedOCRState({
      ...cached,
      paidEnabled: res.data.enabled,
    });

    return res.data.enabled;
  },
};
