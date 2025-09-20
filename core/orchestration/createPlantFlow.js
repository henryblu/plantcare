const defaultIdFactory = () => {
    const cryptoApi = globalThis.crypto;
    if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
        return cryptoApi.randomUUID();
    }
    return `plant-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};
const toIsoString = (value) => {
    if (!value)
        return new Date().toISOString();
    const date = value instanceof Date ? value : new Date(value);
    return date.toISOString();
};
export class CreatePlantFlow {
    constructor(options) {
        this.store = options.store;
        this.cacheFlow = options.cacheFlow;
        this.idFactory = options.idFactory ?? defaultIdFactory;
    }
    async execute(input) {
        const speciesProfile = await this.cacheFlow.resolve(input.species, {
            forceRefresh: input.forcePolicyRefresh,
        });
        const id = input.plant.id?.trim() || this.idFactory();
        const createdAt = toIsoString(input.timestamps?.createdAt);
        const updatedAt = toIsoString(input.timestamps?.updatedAt ?? Date.now());
        const plant = {
            id,
            speciesKey: speciesProfile.speciesKey,
            nickname: input.plant.nickname,
            location: input.plant.location,
            photoUri: input.plant.photoUri,
            createdAt,
            updatedAt,
            lastWateredAt: input.plant.lastWateredAt,
            notes: input.plant.notes,
            moisturePolicyOverride: input.plant.moisturePolicyOverride,
            speciesProfile,
        };
        await this.store.upsertPlant(plant);
        return this.store.getPlant(id) ?? plant;
    }
}
export const createPlantFlow = (options) => new CreatePlantFlow(options);
