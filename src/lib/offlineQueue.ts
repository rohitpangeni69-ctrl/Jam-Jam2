export interface QueuedAction {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
  retryCount: number;
  ttl?: number; // Time to live in ms
}

const DB_NAME = 'rideShareOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'offlineActions';

class OfflineQueueManager {
  private db: IDBDatabase | null = null;
  private isProcessing = false;
  private dbPromise: Promise<void>;

  constructor() {
    this.dbPromise = this.initDB();
  }

  private initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        // Fallback or skip if not in browser
        resolve();
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error('OfflineDB error', event);
        reject('Error opening DB');
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
    });
  }

  public async enqueue(type: string, payload: any, ttl?: number): Promise<string> {
    await this.dbPromise;
    if (!this.db) return '';

    const action: QueuedAction = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      payload,
      timestamp: Date.now(),
      retryCount: 0,
      ttl
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(action);

      request.onsuccess = () => resolve(action.id);
      request.onerror = () => reject(request.error);
    });
  }

  public async getQueue(): Promise<QueuedAction[]> {
    await this.dbPromise;
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  public async remove(id: string): Promise<void> {
    await this.dbPromise;
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async incrementRetry(action: QueuedAction): Promise<void> {
    await this.dbPromise;
    if (!this.db) return;

    action.retryCount += 1;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(action);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const offlineQueue = new OfflineQueueManager();
