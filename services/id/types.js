export const normalizeSpeciesKey = (canonicalName, taxonId) => {
    if (taxonId !== undefined && taxonId !== null) {
        const normalized = String(taxonId).trim();
        if (normalized.length > 0)
            return normalized;
    }
    return canonicalName.trim().toLowerCase();
};
