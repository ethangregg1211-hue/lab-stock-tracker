const DB_NAME = 'LabStockDB';
const DB_VERSION = 2;
let _db = null;

async function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('items')) {
        const s = db.createObjectStore('items', { keyPath: 'id', autoIncrement: true });
        s.createIndex('sessionId', 'sessionId');
        s.createIndex('type', 'type');
      }
      if (!db.objectStoreNames.contains('sessions')) {
        db.createObjectStore('sessions', { keyPath: 'id' });
      }
    };
    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function _tx(store, mode, fn) {
  return new Promise((resolve, reject) => {
    const req = fn(_db.transaction(store, mode).objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const addItemToDB    = item  => _tx('items', 'readwrite', s => s.add({ ...item, createdAt: Date.now() }));
const updateItemInDB = item  => _tx('items', 'readwrite', s => s.put(item));
const deleteItemFromDB = id  => _tx('items', 'readwrite', s => s.delete(id));
const getAllItemsFromDB = ()  => _tx('items', 'readonly',  s => s.getAll());

const saveSession  = data  => _tx('sessions', 'readwrite', s => s.put({ id: 'current', ...data }));
const loadSession  = ()    => _tx('sessions', 'readonly',  s => s.get('current'));
const clearSession = ()    => _tx('sessions', 'readwrite', s => s.delete('current'));
