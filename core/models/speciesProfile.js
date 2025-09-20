import { clampMoisturePolicy, isMoisturePolicy } from './moisturePolicy';
const SPECIES_TYPES = ['succulent', 'semi-succulent', 'tropical', 'fern', 'other'];
const POLICY_SOURCES = ['chatgpt', 'seed', 'cache', 'manual'];
const isIsoDate = (value) => {
    if (typeof value !== 'string')
        return false;
    const time = Date.parse(value);
    return Number.isFinite(time);
};
export function isSpeciesProfile(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const candidate = value;
    if (typeof candidate.speciesKey !== 'string' || candidate.speciesKey.trim().length === 0)
        return false;
    if (typeof candidate.canonicalName !== 'string' || candidate.canonicalName.trim().length === 0)
        return false;
    if (candidate.commonName !== undefined && typeof candidate.commonName !== 'string')
        return false;
    if (typeof candidate.type !== 'string' || !SPECIES_TYPES.includes(candidate.type))
        return false;
    if (candidate.confidence !== undefined) {
        if (typeof candidate.confidence !== 'number')
            return false;
        if (candidate.confidence < 0 || candidate.confidence > 1)
            return false;
    }
    if (!isMoisturePolicy(candidate.moisturePolicy))
        return false;
    if (typeof candidate.source !== 'string' || !POLICY_SOURCES.includes(candidate.source))
        return false;
    if (!isIsoDate(candidate.updatedAt))
        return false;
    if (candidate.createdAt !== undefined && !isIsoDate(candidate.createdAt))
        return false;
    return true;
}
export function normalizeSpeciesProfile(profile) {
    const trimmedCommon = profile.commonName?.trim();
    return {
        ...profile,
        speciesKey: profile.speciesKey.trim().toLowerCase(),
        canonicalName: profile.canonicalName.trim(),
        commonName: trimmedCommon ? trimmedCommon : undefined,
        moisturePolicy: clampMoisturePolicy(profile.moisturePolicy),
        updatedAt: new Date(profile.updatedAt).toISOString(),
        createdAt: profile.createdAt ? new Date(profile.createdAt).toISOString() : undefined,
    };
}
