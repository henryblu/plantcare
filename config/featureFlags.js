const flag = (value, fallback) => {
    if (value === undefined)
        return fallback;
    return value.trim().toLowerCase() === 'true';
};
export const FEATURE_PLANTNET = flag(process.env.FEATURE_PLANTNET, true);
export const FEATURE_CHATGPT = flag(process.env.FEATURE_CHATGPT, true);
export const USE_MOCKS = flag(process.env.USE_MOCKS, false);
export default {
    FEATURE_PLANTNET,
    FEATURE_CHATGPT,
    USE_MOCKS,
};
