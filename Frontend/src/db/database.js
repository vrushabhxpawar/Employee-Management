import Dexie from 'dexie';

export const db = new Dexie('BillOCRDatabase');

db.version(2).stores({  // ✅ Changed version to 2
  employees: '++id, _id, email, phone, name, syncStatus, createdAt, updatedAt',
  pendingSync: '++id, action, entityType, entityId, data, timestamp',
  ocrState: 'key, value',
  fileStorage: '++id, syncId, fileName, fileData, fileType, timestamp',  // ✅ NEW
});

export const SYNC_STATUS = {
  SYNCED: 'synced',
  PENDING: 'pending',
  FAILED: 'failed'
};