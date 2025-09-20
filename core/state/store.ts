import {
  Plant,
  SpeciesProfile,
  MoisturePolicy,
  isPlant,
  isSpeciesProfile,
  normalizePlant,
  normalizeSpeciesProfile,
} from '../models';
import { StorageAdapter } from '../../services/storage/adapter';

export interface StoreState {
  plants: Plant[];
  speciesCache: Record<string, SpeciesProfile>;
}

const DEFAULT_STATE: StoreState = {
  plants: [],
  speciesCache: {},
};

const DEFAULT_KEYS = {
  plants: 'smartplant:plants',
  speciesCache: 'smartplant:species-cache',
};

const cloneMoisturePolicy = (policy: MoisturePolicy): MoisturePolicy => ({
  ...policy,
  notes: [...policy.notes],
});

const cloneSpeciesProfile = (profile: SpeciesProfile): SpeciesProfile => ({
  ...profile,
  moisturePolicy: cloneMoisturePolicy(profile.moisturePolicy),
});

const clonePlant = (plant: Plant): Plant => ({
  ...plant,
  moisturePolicyOverride: plant.moisturePolicyOverride
    ? cloneMoisturePolicy(plant.moisturePolicyOverride)
    : undefined,
  speciesProfile: plant.speciesProfile ? cloneSpeciesProfile(plant.speciesProfile) : undefined,
});

const sanitizePlants = (input: unknown): Plant[] => {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item) => isPlant(item))
    .map((plant) => normalizePlant(plant as Plant));
};

const sanitizeSpeciesCache = (input: unknown): Record<string, SpeciesProfile> => {
  if (typeof input !== 'object' || input === null) return {};
  const entries = Object.entries(input as Record<string, unknown>);
  const result: Record<string, SpeciesProfile> = {};
  entries.forEach(([key, value]) => {
    if (isSpeciesProfile(value)) {
      const profile = normalizeSpeciesProfile(value as SpeciesProfile);
      result[profile.speciesKey] = profile;
    }
  });
  return result;
};

interface StoreOptions {
  storageKeys?: Partial<typeof DEFAULT_KEYS>;
}

export class PlantStore {
  private state: StoreState = { ...DEFAULT_STATE };
  private readonly keys: typeof DEFAULT_KEYS;

  constructor(private readonly storage: StorageAdapter, options: StoreOptions = {}) {
    this.keys = {
      ...DEFAULT_KEYS,
      ...options.storageKeys,
    };
  }

  async hydrate(): Promise<void> {
    const [rawPlants, rawSpecies] = await Promise.all([
      this.storage.getItem(this.keys.plants),
      this.storage.getItem(this.keys.speciesCache),
    ]);

    this.state = {
      plants: sanitizePlants(rawPlants),
      speciesCache: sanitizeSpeciesCache(rawSpecies),
    };
  }

  getState(): StoreState {
    return {
      plants: this.state.plants.map((plant) => clonePlant(this.withSpecies(plant))),
      speciesCache: Object.fromEntries(
        Object.entries(this.state.speciesCache).map(([key, profile]) => [key, cloneSpeciesProfile(profile)]),
      ),
    };
  }

  listPlants(): Plant[] {
    return this.state.plants.map((plant) => clonePlant(this.withSpecies(plant)));
  }

  getPlant(id: string): Plant | undefined {
    const found = this.state.plants.find((plant) => plant.id === id);
    return found ? clonePlant(this.withSpecies(found)) : undefined;
  }

  listSpeciesProfiles(): SpeciesProfile[] {
    return Object.values(this.state.speciesCache).map(cloneSpeciesProfile);
  }

  getSpeciesProfile(speciesKey: string): SpeciesProfile | undefined {
    const key = speciesKey.trim().toLowerCase();
    const profile = this.state.speciesCache[key];
    return profile ? cloneSpeciesProfile(profile) : undefined;
  }

  async upsertPlant(plant: Plant): Promise<void> {
    const normalized = normalizePlant(plant);
    const index = this.state.plants.findIndex((existing) => existing.id === normalized.id);
    if (index >= 0) {
      this.state.plants[index] = normalized;
    } else {
      this.state.plants.push(normalized);
    }
    await this.persistPlants();
  }

  async removePlant(id: string): Promise<void> {
    const next = this.state.plants.filter((plant) => plant.id !== id);
    if (next.length === this.state.plants.length) return;
    this.state.plants = next;
    await this.persistPlants();
  }

  async upsertSpeciesProfile(profile: SpeciesProfile): Promise<void> {
    const normalized = normalizeSpeciesProfile(profile);
    this.state.speciesCache[normalized.speciesKey] = normalized;
    await this.persistSpeciesCache();
  }

  async clear(): Promise<void> {
    this.state = { ...DEFAULT_STATE };
    await Promise.all([
      this.storage.removeItem(this.keys.plants),
      this.storage.removeItem(this.keys.speciesCache),
    ]);
  }

  private withSpecies(plant: Plant): Plant {
    const cached = this.state.speciesCache[plant.speciesKey];
    return cached ? { ...plant, speciesProfile: cached } : plant;
  }

  private async persistPlants(): Promise<void> {
    const serialized = this.state.plants.map(({ speciesProfile, ...rest }) => ({
      ...rest,
      moisturePolicyOverride: rest.moisturePolicyOverride
        ? cloneMoisturePolicy(rest.moisturePolicyOverride)
        : undefined,
    }));
    await this.storage.setItem(this.keys.plants, serialized);
  }

  private async persistSpeciesCache(): Promise<void> {
    const serialized = Object.fromEntries(
      Object.entries(this.state.speciesCache).map(([key, profile]) => [key, cloneSpeciesProfile(profile)]),
    );
    await this.storage.setItem(this.keys.speciesCache, serialized);
  }
}