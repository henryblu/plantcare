const deepClone = (value) => {
    if (value === null || typeof value !== 'object') {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map((item) => deepClone(item));
    }
    const clone = {};
    Object.entries(value).forEach(([key, entry]) => {
        clone[key] = deepClone(entry);
    });
    return clone;
};
export const createMemoryStorage = () => {
    const store = new Map();
    return {
        async getItem(key) {
            if (!store.has(key))
                return null;
            return deepClone(store.get(key));
        },
        async setItem(key, value) {
            store.set(key, deepClone(value));
        },
        async removeItem(key) {
            store.delete(key);
        },
        async clear() {
            store.clear();
        },
        snapshot() {
            const result = {};
            store.forEach((value, key) => {
                result[key] = deepClone(value);
            });
            return result;
        },
    };
};
