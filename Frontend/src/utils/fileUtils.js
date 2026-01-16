// Convert File to Base64
export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Convert Base64 to File
export const base64ToFile = (base64, fileName, mimeType) => {
  const arr = base64.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  
  return new File([u8arr], fileName, { type: mimeType || mime });
};

// Store files in IndexedDB
export const storeFiles = async (db, syncId, files) => {
  const fileRecords = [];
  
  for (const file of files) {
    const base64 = await fileToBase64(file);
    fileRecords.push({
      syncId,
      fileName: file.name,
      fileData: base64,
      fileType: file.type,
      timestamp: new Date().toISOString(),
    });
  }
  
  if (fileRecords.length > 0) {
    await db.fileStorage.bulkAdd(fileRecords);
  }
  
  return fileRecords;
};

// Retrieve files from IndexedDB
export const retrieveFiles = async (db, syncId) => {
  const fileRecords = await db.fileStorage.where('syncId').equals(syncId).toArray();
  
  return fileRecords.map(record => 
    base64ToFile(record.fileData, record.fileName, record.fileType)
  );
};