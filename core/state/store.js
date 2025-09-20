import { isPlant, isSpeciesProfile, normalizePlant, normalizeSpeciesProfile, } from '../models';
const DEFAULT_STATE = {
    plants: [],
    speciesCache: {},
};
const DEFAULT_KEYS = {
    plants: 'smartplant:plants',
    speciesCache: 'smartplant:species-cache',
};
const cloneMoisturePolicy = (policy) => ({
    ...policy,
    notes: [...policy.notes],
});
const cloneSpeciesProfile = (profile) => ({
    ...profile,
    moisturePolicy: cloneMoisturePolicy(profile.moisturePolicy),
});
const clonePlant = (plant) => ({
    ...plant,
    moisturePolicyOverride: plant.moisturePolicyOverride
        ? cloneMoisturePolicy(plant.moisturePolicyOverride)
        : undefined,
    speciesProfile: plant.speciesProfile ? cloneSpeciesProfile(plant.speciesProfile) : undefined,
});
const sanitizePlants = (input) => {
    if (!Array.isArray(input))
        return [];
    return input
        .filter((item) => isPlant(item))
        .map((plant) => normalizePlant(plant));
};
const sanitizeSpeciesCache = (input) => {
    if (typeof input !== 'object' || input === null)
        return {};
    const entries = Object.entries(input);
    const result = {};
    entries.forEach(([key, value]) => {
        if (isSpeciesProfile(value)) {
            const profile = normalizeSpeciesProfile(value);
            result[profile.speciesKey] = profile;
        }
    });
    return result;
};
export class PlantStore {
    constructor(storage, options = {}) {
        this.storage = storage;
        this.state = { ...DEFAULT_STATE };
        this.keys = {
            ...DEFAULT_KEYS,
            ...options.storageKeys,
        };
    }
    async hydrate() {
        const [rawPlants, rawSpecies] = await Promise.all([
            this.storage.getItem(this.keys.plants),
            this.storage.getItem(this.keys.speciesCache),
        ]);
        this.state = {
            plants: sanitizePlants(rawPlants),
            speciesCache: sanitizeSpeciesCache(rawSpecies),
        };
    }
    getState() {
        return {
            plants: this.state.plants.map((plant) => clonePlant(this.withSpecies(plant))),
            speciesCache: Object.fromEntries(Object.entries(this.state.speciesCache).map(([key, profile]) => [key, cloneSpeciesProfile(profile)])),
        };
    }
    listPlants() {
        return this.state.plants.map((plant) => clonePlant(this.withSpecies(plant)));
    }
    getPlant(id) {
        const found = this.state.plants.find((plant) => plant.id === id);
        return found ? clonePlant(this.withSpecies(found)) : undefined;
    }
    listSpeciesProfiles() {
        return Object.values(this.state.speciesCache).map(cloneSpeciesProfile);
    }
    getSpeciesProfile(speciesKey) {
        const key = speciesKey.trim().toLowerCase();
        const profile = this.state.speciesCache[key];
        return profile ? cloneSpeciesProfile(profile) : undefined;
    }
    async upsertPlant(plant) {
        const normalized = normalizePlant(plant);
        const index = this.state.plants.findIndex((existing) => existing.id === normalized.id);
        if (index >= 0) {
            this.state.plants[index] = normalized;
        }
        else {
            this.state.plants.push(normalized);
        }
        await this.persistPlants();
    }
    async removePlant(id) {
        const next = this.state.plants.filter((plant) => plant.id !== id);
        if (next.length === this.state.plants.length)
            return;
        this.state.plants = next;
        await this.persistPlants();
    }
    async upsertSpeciesProfile(profile) {
        const normalized = normalizeSpeciesProfile(profile);
        this.state.speciesCache[normalized.speciesKey] = normalized;
        await this.persistSpeciesCache();
    }
    async clear() {
        this.state = { ...DEFAULT_STATE };
        await Promise.all([
            this.storage.removeItem(this.keys.plants),
            this.storage.removeItem(this.keys.speciesCache),
        ]);
    }
    withSpecies(plant) {
        const cached = this.state.speciesCache[plant.speciesKey];
        return cached ? { ...plant, speciesProfile: cached } : plant;
    }
    async persistPlants() {
        const serialized = this.state.plants.map(({ speciesProfile, ...rest }) => ({
            ...rest,
            moisturePolicyOverride: rest.moisturePolicyOverride
                ? cloneMoisturePolicy(rest.moisturePolicyOverride)
                : undefined,
        }));
        await this.storage.setItem(this.keys.plants, serialized);
    }
    async persistSpeciesCache() {
        const serialized = Object.fromEntries(Object.entries(this.state.speciesCache).map(([key, profile]) => [key, cloneSpeciesProfile(profile)]));
        await this.storage.setItem(this.keys.speciesCache, serialized);
    }
}
