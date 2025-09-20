export interface StorageAdapter {
  getItem<T = unknown>(key: string): Promise<T | null>;
  setItem<T>(key: string, value: T): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
  removeItem(key: string): Promise<void> | void;
}

const ensurePromise = <T>(value: Promise<T> | T): Promise<T> =>
  value instanceof Promise ? value : Promise.resolve(value);

const normalizeKey = (namespace: string | undefined, key: string): string => {
  if (!namespace) return key;
  return `${namespace}:${key}`;
};

export const createJsonStorage = (storage: KeyValueStorage, namespace?: string): StorageAdapter => ({
  async getItem(key) {
    const raw = await ensurePromise(storage.getItem(normalizeKey(namespace, key)));
    if (raw === null || raw === undefined) return null;
    try {
      return JSON.parse(raw);
    } catch (error) {
      throw new Error(`Failed to parse stored JSON for key "${key}": ${(error as Error).message}`);
    }
  },
  async setItem(key, value) {
    const payload = JSON.stringify(value ?? null);
    await ensurePromise(storage.setItem(normalizeKey(namespace, key), payload));
  },
  async removeItem(key) {
    await ensurePromise(storage.removeItem(normalizeKey(namespace, key)));
  },
});

export const createNamespacedStorage = (adapter: StorageAdapter, namespace: string): StorageAdapter => ({
  async getItem(key) {
    return adapter.getItem(normalizeKey(namespace, key));
  },
  async setItem(key, value) {
    await adapter.setItem(normalizeKey(namespace, key), value);
  },
  async removeItem(key) {
    await adapter.removeItem(normalizeKey(namespace, key));
  },
});