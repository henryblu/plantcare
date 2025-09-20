const safeParse = (value) => {
    if (value === null || value === undefined)
        return null;
    try {
        return JSON.parse(value);
    }
    catch (error) {
        console.warn("Failed to parse localStorage payload", error);
        return null;
    }
};
const safeStringify = (value) => {
    try {
        return JSON.stringify(value ?? null);
    }
    catch (error) {
        console.warn("Failed to serialise payload", error);
        return "null";
    }
};
export const createBrowserStorage = (namespace = "smartplant") => {
    const storage = window.localStorage;
    const resolveKey = (key) => `${namespace}:${key}`;
    return {
        async getItem(key) {
            return safeParse(storage.getItem(resolveKey(key)));
        },
        async setItem(key, value) {
            storage.setItem(resolveKey(key), safeStringify(value));
        },
        async removeItem(key) {
            storage.removeItem(resolveKey(key));
        },
    };
};
