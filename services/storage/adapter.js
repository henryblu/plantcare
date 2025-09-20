const ensurePromise = (value) => value instanceof Promise ? value : Promise.resolve(value);
const normalizeKey = (namespace, key) => {
    if (!namespace)
        return key;
    return `${namespace}:${key}`;
};
export const createJsonStorage = (storage, namespace) => ({
    async getItem(key) {
        const raw = await ensurePromise(storage.getItem(normalizeKey(namespace, key)));
        if (raw === null || raw === undefined)
            return null;
        try {
            return JSON.parse(raw);
        }
        catch (error) {
            throw new Error(`Failed to parse stored JSON for key "${key}": ${error.message}`);
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
export const createNamespacedStorage = (adapter, namespace) => ({
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
