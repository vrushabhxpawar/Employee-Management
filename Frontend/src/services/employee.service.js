import axios from "axios";
import { db, SYNC_STATUS } from "../db/database";
import { storeFiles, retrieveFiles } from '../utils/fileUtils'

const API_BASE = import.meta.env.VITE_API_URL;
const API_URL = `${API_BASE}/api/employees`;

class EmployeeService {
  // Fetch all employees
  async fetchEmployees() {
    if (navigator.onLine) {
      try {
        const res = await axios.get(API_URL);
        const employees = res.data.data || res.data;

        // Save to IndexedDB
        await db.employees.clear();
        await db.employees.bulkAdd(
          employees.map((emp) => ({
            ...emp,
            syncStatus: SYNC_STATUS.SYNCED,
          }))
        );

        // Also save to localStorage as backup
        localStorage.setItem("cachedEmployees", JSON.stringify(employees));
        return employees;
      } catch (error) {
        console.error("Failed to fetch from server:", error);
        // Fallback to IndexedDB
        const cached = await db.employees.toArray();
        if (cached.length > 0) return cached;

        // Final fallback to localStorage
        const localCached = localStorage.getItem("cachedEmployees");
        return localCached ? JSON.parse(localCached) : [];
      }
    } else {
      // Offline: Read from IndexedDB
      const cached = await db.employees.toArray();
      return cached.filter((emp) => !emp._markedForDeletion);
    }
  }

  // Create employee
  async createEmployee(formData) {
    if (navigator.onLine) {
      // eslint-disable-next-line no-useless-catch
      try {
        // Try to create on server
        const res = await axios.post(API_URL, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        const employee = {
          ...res.data.data,
          syncStatus: SYNC_STATUS.SYNCED,
        };
        await db.employees.add(employee);
        return { success: true, data: employee };
      } catch (error) {
        throw error;
      }
    } else {
      // ✅ OFFLINE: Save files to IndexedDB
      const syncId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Extract files from FormData
      const files = formData.getAll('files');
      
      // Store files in IndexedDB
      await storeFiles(db, syncId, files);
      
      // Save employee data
      const employee = {
        _id: `local_${Date.now()}`,
        name: formData.get('name'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        files: [],
        syncStatus: SYNC_STATUS.PENDING,
        createdAt: new Date().toISOString(),
      };
      
      await db.employees.add(employee);
      
      // ✅ Save to pending sync with syncId reference
      await db.pendingSync.add({
        action: 'create',
        entityType: 'employee',
        entityId: employee._id,
        syncId: syncId,  // ✅ Link to stored files
        data: {
          name: formData.get('name'),
          email: formData.get('email'),
          phone: formData.get('phone'),
        },
        timestamp: new Date().toISOString(),
      });
      
      return { success: true, data: employee, offline: true };
    }
  }

  // UPDATE Employee with files
  async updateEmployee(id, formData) {
    if (navigator.onLine) {
      // eslint-disable-next-line no-useless-catch
      try {
        const res = await axios.put(`${API_URL}/${id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        const employee = {
          ...res.data.data,
          syncStatus: SYNC_STATUS.SYNCED
        };
        await db.employees.where('_id').equals(id).modify(employee);
        return { success: true, data: employee };
      } catch (error) {
        throw error;
      }
    } else {
      // ✅ OFFLINE: Save files to IndexedDB
      const syncId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const files = formData.getAll('files');
      if (files.length > 0) {
        await storeFiles(db, syncId, files);
      }
      
      const updates = {
        name: formData.get('name'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        syncStatus: SYNC_STATUS.PENDING,
        updatedAt: new Date().toISOString(),
      };
      
      await db.employees.where('_id').equals(id).modify(updates);
      
      await db.pendingSync.add({
        action: 'update',
        entityType: 'employee',
        entityId: id,
        syncId: files.length > 0 ? syncId : null,  // ✅ Only if files exist
        data: {
          name: formData.get('name'),
          email: formData.get('email'),
          phone: formData.get('phone'),
          existingFiles: formData.get('existingFiles'),
        },
        timestamp: new Date().toISOString(),
      });
      
      return { success: true, offline: true };
    }
  }

  // ✅ UPDATED: Sync with file reconstruction
  async syncPendingChanges() {
    if (!navigator.onLine) return { synced: 0, failed: 0 };

    const pending = await db.pendingSync.toArray();
    
    if (pending.length === 0) {
      return { synced: 0, failed: 0 };
    }

    let synced = 0;
    let failed = 0;

    for (const item of pending) {
      try {
        if (!item.data && item.action !== 'delete') {
          await db.pendingSync.delete(item.id);
          continue;
        }

        // ✅ Reconstruct FormData with files
        const formData = new FormData();
        
        // Add text data
        if (item.data) {
          Object.keys(item.data).forEach(key => {
            if (item.data[key] !== null && item.data[key] !== undefined) {
              formData.append(key, item.data[key]);
            }
          });
        }
        
        // ✅ Retrieve and add stored files
        if (item.syncId) {
          const files = await retrieveFiles(db, item.syncId);
          files.forEach(file => {
            formData.append('files', file);
          });
        }

        switch (item.action) {
          case 'create':
            await axios.post(API_URL, formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
            });
            break;
          case 'update':
            { const exists = await db.employees.where('_id').equals(item.entityId).first();
            if (!exists) {
              await db.pendingSync.delete(item.id);
              continue;
            }
            await axios.put(`${API_URL}/${item.entityId}`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
            });
            break; }
          case 'delete':
            await axios.delete(`${API_URL}/${item.entityId}`);
            break;
        }

        // ✅ Clean up: Delete stored files after successful sync
        if (item.syncId) {
          await db.fileStorage.where('syncId').equals(item.syncId).delete();
        }

        if (item.action !== 'delete' && item.entityId) {
          await db.employees.where('_id').equals(item.entityId).modify({
            syncStatus: SYNC_STATUS.SYNCED
          });
        }

        await db.pendingSync.delete(item.id);
        synced++;
        
      } catch (error) {
        console.error(`Sync failed for ${item.action}:`, error);
        
        if (error.response?.status === 404) {
          await db.pendingSync.delete(item.id);
          if (item.entityId) {
            await db.employees.where('_id').equals(item.entityId).delete();
          }
          if (item.syncId) {
            await db.fileStorage.where('syncId').equals(item.syncId).delete();
          }
        } else {
          if (item.entityId) {
            await db.employees.where('_id').equals(item.entityId).modify({
              syncStatus: SYNC_STATUS.FAILED
            });
          }
          failed++;
        }
      }
    }

    return { synced, failed };
  }

  // Delete employee
  async deleteEmployee(id) {
    if (navigator.onLine) {
      // eslint-disable-next-line no-useless-catch
      try {
        await axios.delete(`${API_URL}/${id}`);
        await db.employees.where("_id").equals(id).delete();
        return { success: true };
      } catch (error) {
        throw error;
      }
    } else {
      // Offline: Mark for deletion
      await db.employees.where("_id").equals(id).modify({
        _markedForDeletion: true,
        syncStatus: SYNC_STATUS.PENDING,
      });
      await db.pendingSync.add({
        action: "delete",
        entityType: "employee",
        entityId: id,
        timestamp: new Date().toISOString(),
      });

      return { success: true, offline: true };
    }
  }

  // Get pending sync count
  async getPendingSyncCount() {
    return await db.pendingSync.count();
  }

  // Fetch OCR state
  async fetchOCRState() {
    if (navigator.onLine) {
      try {
        const [quotaRes, paidRes] = await Promise.all([
          axios.get(`${API_BASE}/api/admin/ocr-quota`),
          axios.get(`${API_BASE}/api/admin/ocr-paid-status`),
        ]);

        const ocrState = {
          quota: quotaRes.data,
          paidEnabled: paidRes.data.enabled,
        };

        // Cache in IndexedDB
        await db.ocrState.put({ key: "current", value: ocrState });
        return ocrState;
        // eslint-disable-next-line no-unused-vars
      } catch (error) {
        // Fallback to cached
        const cached = await db.ocrState.get("current");
        return cached?.value || { quota: null, paidEnabled: false };
      }
    } else {
      const cached = await db.ocrState.get("current");
      return cached?.value || { quota: null, paidEnabled: false };
    }
  }
}

export default new EmployeeService();
