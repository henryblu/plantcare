import { clampMoisturePolicy } from '../models/moisturePolicy';
export const SUPPORTED_SPECIES_TYPES = [
    'succulent',
    'semi-succulent',
    'tropical',
    'fern',
    'other',
];
const HUMIDITY_VALUES = ['low', 'medium', 'high'];
const LIGHT_VALUES = ['low', 'medium', 'bright-indirect', 'full-sun'];
const isRecord = (value) => typeof value === 'object' && value !== null;
const normalizeSpeciesType = (value, fallback) => {
    if (typeof value !== 'string')
        return fallback;
    const normalized = value.trim().toLowerCase();
    const match = SUPPORTED_SPECIES_TYPES.find((type) => type === normalized);
    return match ?? fallback;
};
const coerceInteger = (value, label) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.round(value);
    }
    if (typeof value === 'string') {
        const parsed = Number.parseFloat(value.trim());
        if (Number.isFinite(parsed)) {
            return Math.round(parsed);
        }
    }
    throw new PolicySchemaError(`${label} must be a finite number.`);
};
const coerceEnum = (value, allowed, label) => {
    if (typeof value !== 'string') {
        throw new PolicySchemaError(`${label} must be a string.`);
    }
    const normalized = value.trim().toLowerCase();
    const match = allowed.find((option) => option === normalized);
    if (!match) {
        throw new PolicySchemaError(`${label} must be one of: ${allowed
            .map((option) => `"${option}"`)
            .join(', ')}.`);
    }
    return match;
};
const coerceNotes = (value) => {
    if (!Array.isArray(value)) {
        throw new PolicySchemaError('moisturePolicy.notes must be an array.');
    }
    return value
        .map((note) => (typeof note === 'string' ? note.trim() : ''))
        .filter((note) => note.length > 0)
        .map((note) => note.slice(0, 160));
};
const parseMoisturePolicy = (value) => {
    if (!isRecord(value)) {
        throw new PolicySchemaError('moisturePolicy must be an object.');
    }
    const waterIntervalDays = coerceInteger(value.waterIntervalDays, 'moisturePolicy.waterIntervalDays');
    const soilMoistureThreshold = coerceInteger(value.soilMoistureThreshold, 'moisturePolicy.soilMoistureThreshold');
    const humidityPreference = coerceEnum(value.humidityPreference, HUMIDITY_VALUES, 'moisturePolicy.humidityPreference');
    const lightRequirement = coerceEnum(value.lightRequirement, LIGHT_VALUES, 'moisturePolicy.lightRequirement');
    if (!('notes' in value)) {
        throw new PolicySchemaError('moisturePolicy.notes is required.');
    }
    const notes = coerceNotes(value.notes);
    return {
        waterIntervalDays,
        soilMoistureThreshold,
        humidityPreference,
        lightRequirement,
        notes,
    };
};
export class PolicySchemaError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PolicySchemaError';
    }
}
export const normalizePolicyPayload = (payload, options = {}) => {
    const fallbackType = options.fallbackType ?? 'other';
    if (!SUPPORTED_SPECIES_TYPES.includes(fallbackType)) {
        throw new PolicySchemaError(`Unsupported fallback species type: ${fallbackType}`);
    }
    if (!isRecord(payload)) {
        throw new PolicySchemaError('Policy payload must be an object.');
    }
    const normalizedType = normalizeSpeciesType(payload.type, fallbackType);
    const normalizedPolicy = clampMoisturePolicy(parseMoisturePolicy(payload.moisturePolicy));
    return {
        type: normalizedType,
        moisturePolicy: normalizedPolicy,
    };
};
