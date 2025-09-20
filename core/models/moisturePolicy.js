const HUMIDITY_OPTIONS = ['low', 'medium', 'high'];
const LIGHT_OPTIONS = ['low', 'medium', 'bright-indirect', 'full-sun'];
const MAX_NOTES = 2;
const MAX_THRESHOLD = 60;
export function isMoisturePolicy(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const candidate = value;
    const waterInterval = candidate.waterIntervalDays;
    if (typeof waterInterval !== 'number' || !Number.isInteger(waterInterval))
        return false;
    if (waterInterval < 0 || waterInterval > MAX_THRESHOLD)
        return false;
    const soilThreshold = candidate.soilMoistureThreshold;
    if (typeof soilThreshold !== 'number')
        return false;
    if (soilThreshold < 0 || soilThreshold > MAX_THRESHOLD)
        return false;
    const humidity = candidate.humidityPreference;
    if (typeof humidity !== 'string')
        return false;
    if (!HUMIDITY_OPTIONS.includes(humidity))
        return false;
    const light = candidate.lightRequirement;
    if (typeof light !== 'string')
        return false;
    if (!LIGHT_OPTIONS.includes(light))
        return false;
    const notes = candidate.notes;
    if (!Array.isArray(notes))
        return false;
    if (notes.length > MAX_NOTES)
        return false;
    if (!notes.every((note) => typeof note === 'string' && note.trim().length > 0 && note.length <= 160)) {
        return false;
    }
    return true;
}
export function clampMoisturePolicy(policy) {
    return {
        ...policy,
        waterIntervalDays: Math.max(0, Math.min(MAX_THRESHOLD, Math.round(policy.waterIntervalDays))),
        soilMoistureThreshold: Math.max(0, Math.min(MAX_THRESHOLD, Math.round(policy.soilMoistureThreshold))),
        notes: policy.notes
            .slice(0, MAX_NOTES)
            .map((note) => note.trim().slice(0, 160))
            .filter((note) => note.length > 0),
    };
}
