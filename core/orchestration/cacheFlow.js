const DEFAULT_TTL_MS = 180 * 24 * 60 * 60 * 1000; // 180 days
const isFresh = (profile, ttlMs, referenceMs) => {
    const updated = Date.parse(profile.updatedAt);
    if (!Number.isFinite(updated))
        return false;
    return referenceMs - updated <= ttlMs;
};
const normalizeKey = (key) => key.trim().toLowerCase();
export class SpeciesCacheFlow {
    constructor(options) {
        this.store = options.store;
        this.policyService = options.policyService;
        this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    }
    async resolve(request, options = {}) {
        const speciesKey = normalizeKey(request.speciesKey);
        const now = options.now?.getTime() ?? Date.now();
        const forceRefresh = options.forceRefresh ?? false;
        if (!forceRefresh) {
            const cached = this.store.getSpeciesProfile(speciesKey);
            if (cached && isFresh(cached, this.ttlMs, now)) {
                return cached;
            }
        }
        const profile = await this.policyService.generate({
            ...request,
            speciesKey,
        });
        await this.store.upsertSpeciesProfile(profile);
        return profile;
    }
}
export const createSpeciesCacheFlow = (options) => new SpeciesCacheFlow(options);
