// IndexedDB utility for offline data storage

const DB_NAME = 'mm-hrm-db';
const DB_VERSION = 1;

interface DBStore {
  name: string;
  keyPath: string;
  indexes?: { name: string; keyPath: string; unique?: boolean }[];
}

const STORES: DBStore[] = [
  {
    name: 'attendance',
    keyPath: 'id',
    indexes: [{ name: 'date', keyPath: 'date', unique: false }],
  },
  {
    name: 'leaves',
    keyPath: 'id',
    indexes: [{ name: 'userId', keyPath: 'userId', unique: false }],
  },
  {
    name: 'notifications',
    keyPath: 'id',
    indexes: [{ name: 'userId', keyPath: 'userId', unique: false }],
  },
  {
    name: 'cache',
    keyPath: 'key',
  },
];

let db: IDBDatabase | null = null;

export async function initDB(): Promise<IDBDatabase> {
  if (db) {
    return db;
  }

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB is not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Create object stores
      STORES.forEach((store) => {
        if (!database.objectStoreNames.contains(store.name)) {
          const objectStore = database.createObjectStore(store.name, {
            keyPath: store.keyPath,
          });

          // Create indexes
          if (store.indexes) {
            store.indexes.forEach((index) => {
              objectStore.createIndex(index.name, index.keyPath, {
                unique: index.unique || false,
              });
            });
          }
        }
      });
    };
  });
}

export async function addData<T>(storeName: string, data: T): Promise<void> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.add(data);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to add data'));
  });
}

export async function getData<T>(storeName: string, key: string): Promise<T | undefined> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(new Error('Failed to get data'));
  });
}

export async function getAllData<T>(storeName: string): Promise<T[]> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(new Error('Failed to get all data'));
  });
}

export async function updateData<T>(storeName: string, data: T): Promise<void> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(data);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to update data'));
  });
}

export async function deleteData(storeName: string, key: string): Promise<void> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to delete data'));
  });
}

export async function clearStore(storeName: string): Promise<void> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to clear store'));
  });
}

export async function queryByIndex<T>(
  storeName: string,
  indexName: string,
  value: any
): Promise<T[]> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(value);

    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(new Error('Failed to query by index'));
  });
}

