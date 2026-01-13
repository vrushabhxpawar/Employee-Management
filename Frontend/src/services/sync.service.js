import axios from "axios";
import {
  getQueueItems,
  removeQueueItem,
  setCachedEmployees,
} from "./cache/indexedDb.js";

const API_BASE = import.meta.env.VITE_API_URL;
const EMPLOYEE_API = `${API_BASE}/api/employees`;

let isSyncing = false;

/**
 * Sync all pending offline actions.
 * @returns {boolean} didSync - whether anything was actually synced
 */
export async function syncPendingActions() {
  if (!navigator.onLine) return false;
  if (isSyncing) return false;

  isSyncing = true;
  let didSync = false;

  try {
    const queue = await getQueueItems();

    for (const item of queue) {
      try {
        /* ================= EMPLOYEE CREATE ================= */
        if (item.entity === "EMPLOYEE" && item.action === "CREATE") {
          const formData = new FormData();

          formData.append("name", item.payload.data.name);
          formData.append("email", item.payload.data.email);
          formData.append("phone", item.payload.data.phone);

          // ⚠️ files are NOT supported offline yet (by design)

          await axios.post(EMPLOYEE_API, formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        }

        /* ================= EMPLOYEE UPDATE ================= */
        if (item.entity === "EMPLOYEE" && item.action === "UPDATE") {
          const formData = new FormData();

          formData.append("name", item.payload.data.name);
          formData.append("email", item.payload.data.email);
          formData.append("phone", item.payload.data.phone);

          await axios.put(
            `${EMPLOYEE_API}/${item.payload.id}`,
            formData,
            { headers: { "Content-Type": "multipart/form-data" } }
          );
        }

        /* ================= EMPLOYEE DELETE ================= */
        if (item.entity === "EMPLOYEE" && item.action === "DELETE") {
          await axios.delete(
            `${EMPLOYEE_API}/${item.payload.id}`
          );
        }

        // ✅ Only remove queue item AFTER success
        await removeQueueItem(item.id);
        didSync = true;
      } catch (err) {
        console.error(
          `[SYNC] Failed action ${item.entity}:${item.action}`,
          err
        );
        // ❌ do not remove item → retry later
      }
    }

    /* ================= REFRESH CACHE AFTER SYNC ================= */
    if (didSync) {
      const res = await axios.get(EMPLOYEE_API);
      const employees = Array.isArray(res.data.data)
        ? res.data.data
        : Array.isArray(res.data)
        ? res.data
        : [];

      await setCachedEmployees(employees);
    }
  } catch (err) {
    console.error("[SYNC] Sync process crashed", err);
  } finally {
    isSyncing = false;
  }

  return didSync;
}
