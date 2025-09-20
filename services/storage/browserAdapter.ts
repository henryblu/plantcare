import { StorageAdapter } from "./adapter";

type Serializable = unknown;

const safeParse = (value: string | null): unknown => {
  if (value === null || value === undefined) return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn("Failed to parse localStorage payload", error);
    return null;
  }
};

const safeStringify = (value: Serializable): string => {
  try {
    return JSON.stringify(value ?? null);
  } catch (error) {
    console.warn("Failed to serialise payload", error);
    return "null";
  }
};

export const createBrowserStorage = (namespace = "smartplant"): StorageAdapter => {
  const storage = window.localStorage;

  const resolveKey = (key: string) => `${namespace}:${key}`;

  return {
    async getItem<T = unknown>(key: string): Promise<T | null> {
      return safeParse(storage.getItem(resolveKey(key))) as T | null;
    },
    async setItem<T>(key: string, value: T): Promise<void> {
      storage.setItem(resolveKey(key), safeStringify(value as Serializable));
    },
    async removeItem(key: string): Promise<void> {
      storage.removeItem(resolveKey(key));
    },
  };
};
