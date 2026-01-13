const DB_NAME = "bill_app_db";
const DB_VERSION = 3;

const EMPLOYEE_STORE = "employees";
const OCR_STORE = "ocr_state";
const QUEUE_STORE = "write_queue";

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(EMPLOYEE_STORE)) {
        db.createObjectStore(EMPLOYEE_STORE, { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains(OCR_STORE)) {
        db.createObjectStore(OCR_STORE, { keyPath: "key" });
      }

       if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}


/* ================= EMPLOYEE CACHE ================= */

export async function getCachedEmployees() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(EMPLOYEE_STORE, "readonly");
    const store = tx.objectStore(EMPLOYEE_STORE);
    const req = store.get("employees");

    req.onsuccess = () => resolve(req.result?.data || []);
    req.onerror = () => resolve([]);
  });
}

export async function setCachedEmployees(data) {
  const db = await openDB();
  const tx = db.transaction(EMPLOYEE_STORE, "readwrite");
  const store = tx.objectStore(EMPLOYEE_STORE);

  store.put({
    key: "employees",
    data,
    lastUpdated: Date.now(),
  });

  return tx.complete;
}

/* ================= OCR CACHE ================= */

export async function getCachedOCRState() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(OCR_STORE, "readonly");
    const store = tx.objectStore(OCR_STORE);
    const req = store.get("ocr");

    req.onsuccess = () => {
      resolve(req.result?.data || null);
    };
    req.onerror = () => resolve(null);
  });
}

export async function setCachedOCRState(data) {
  const db = await openDB();
  const tx = db.transaction(OCR_STORE, "readwrite");
  const store = tx.objectStore(OCR_STORE);

  store.put({
    key: "ocr",
    data,
    lastUpdated: Date.now(),
  });

  return tx.complete;
}

/* ================= WRITE QUEUE ================= */

export async function addToQueue(action) {
  const db = await openDB();
  const tx = db.transaction(QUEUE_STORE, "readwrite");
  tx.objectStore(QUEUE_STORE).put(action);
  return tx.complete;
}

export async function getQueueItems() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(QUEUE_STORE, "readonly");
    const req = tx.objectStore(QUEUE_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
  });
}

export async function removeQueueItem(id) {
  const db = await openDB();
  const tx = db.transaction(QUEUE_STORE, "readwrite");
  tx.objectStore(QUEUE_STORE).delete(id);
  return tx.complete;
}
