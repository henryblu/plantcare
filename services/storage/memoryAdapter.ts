import { StorageAdapter } from './adapter';

type Serializable = string | number | boolean | null | undefined | Serializable[] | { [key: string]: Serializable };

const deepClone = <T extends Serializable>(value: T): T => {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => deepClone(item)) as T;
  }

  const clone: { [key: string]: Serializable } = {};
  Object.entries(value).forEach(([key, entry]) => {
    clone[key] = deepClone(entry as Serializable);
  });
  return clone as T;
};

export interface MemoryStorageAdapter extends StorageAdapter {
  clear(): Promise<void>;
  snapshot(): Record<string, Serializable>;
}

export const createMemoryStorage = (): MemoryStorageAdapter => {
  const store = new Map<string, Serializable>();

  return {
    async getItem<T = unknown>(key: string): Promise<T | null> {
      if (!store.has(key)) return null;
      return deepClone(store.get(key) as Serializable) as T;
    },
    async setItem(key, value) {
      store.set(key, deepClone(value as Serializable));
    },
    async removeItem(key) {
      store.delete(key);
    },
    async clear() {
      store.clear();
    },
    snapshot() {
      const result: Record<string, Serializable> = {};
      store.forEach((value, key) => {
        result[key] = deepClone(value);
      });
      return result;
    },
  };
};
