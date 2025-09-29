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
import {
  PLANTS_SCHEMA_VERSION,
  SPECIES_CACHE_SCHEMA_VERSION,
  createDefaultStorageKeys,
  isPersistedPlantsPayload,
  isPersistedSpeciesCachePayload,
  type PersistedPlantsPayload,
  type PersistedSpeciesCachePayload,
  type StorageKeys,
} from '../../services/storage/schema';

export interface StoreState {
  plants: Plant[];
  speciesCache: Record<string, CachedSpeciesEntry>;
}

const DEFAULT_STATE: StoreState = {
  plants: [],
  speciesCache: {},
};

const DEFAULT_KEYS = createDefaultStorageKeys();

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_SPECIES_TTL_DAYS = 180;

interface SanitizedPlantsResult {
  plants: Plant[];
  migrated: boolean;
  invalidCount: number;
  sourceVersion: number | null;
  futureVersion: number | null;
}

interface SanitizedSpeciesResult {
  entries: Record<string, CachedSpeciesEntry>;
  migrated: boolean;
  invalidCount: number;
  sourceVersion: number | null;
  futureVersion: number | null;
}

export interface CachedSpeciesEntry {
  profile: SpeciesProfile;
  ttlDays: number;
  refreshedAt: string;
  source: SpeciesProfile['source'];
}

export interface SpeciesCacheMetadata {
  ttlDays?: number;
  refreshedAt?: string | Date;
  source?: SpeciesProfile['source'];
}

const cloneMoisturePolicy = (policy: MoisturePolicy): MoisturePolicy => ({
  ...policy,
  notes: [...policy.notes],
});

const cloneSpeciesProfile = (profile: SpeciesProfile): SpeciesProfile => ({
  ...profile,
  moisturePolicy: cloneMoisturePolicy(profile.moisturePolicy),
});

const cloneCachedSpeciesEntry = (entry: CachedSpeciesEntry): CachedSpeciesEntry => ({
  profile: cloneSpeciesProfile(entry.profile),
  ttlDays: entry.ttlDays,
  refreshedAt: entry.refreshedAt,
  source: entry.source,
});

const clonePlant = (plant: Plant): Plant => ({
  ...plant,
  moisturePolicyOverride: plant.moisturePolicyOverride
    ? cloneMoisturePolicy(plant.moisturePolicyOverride)
    : undefined,
  speciesProfile: plant.speciesProfile ? cloneSpeciesProfile(plant.speciesProfile) : undefined,
});

const sanitizePlantArray = (input: unknown[]): { plants: Plant[]; invalidCount: number } => {
  const normalized: Plant[] = [];
  let invalidCount = 0;

  input.forEach((item) => {
    if (isPlant(item)) {
      normalized.push(normalizePlant(item as Plant));
    } else {
      invalidCount += 1;
    }
  });

  return { plants: normalized, invalidCount };
};

const sanitizePersistedPlants = (input: unknown): SanitizedPlantsResult => {
  if (input === null || input === undefined) {
    return { plants: [], migrated: false, invalidCount: 0, sourceVersion: null, futureVersion: null };
  }

  if (isPersistedPlantsPayload(input)) {
    const { schemaVersion, plants } = input as PersistedPlantsPayload;
    if (!Number.isFinite(schemaVersion)) {
      return { plants: [], migrated: false, invalidCount: 0, sourceVersion: null, futureVersion: null };
    }
    if (schemaVersion > PLANTS_SCHEMA_VERSION) {
      return { plants: [], migrated: false, invalidCount: 0, sourceVersion: schemaVersion, futureVersion: schemaVersion };
    }
    const { plants: normalized, invalidCount } = sanitizePlantArray(plants);
    return {
      plants: normalized,
      migrated: schemaVersion < PLANTS_SCHEMA_VERSION,
      invalidCount,
      sourceVersion: schemaVersion,
      futureVersion: null,
    };
  }

  if (Array.isArray(input)) {
    const { plants, invalidCount } = sanitizePlantArray(input);
    return { plants, migrated: true, invalidCount, sourceVersion: null, futureVersion: null };
  }

  if (typeof input === 'object' && input !== null) {
    const candidate = input as Record<string, unknown>;
    if (Array.isArray(candidate.plants)) {
      const { plants, invalidCount } = sanitizePlantArray(candidate.plants);
      return { plants, migrated: true, invalidCount, sourceVersion: null, futureVersion: null };
    }
  }

  return { plants: [], migrated: false, invalidCount: 0, sourceVersion: null, futureVersion: null };
};

const normalizeRefreshedAt = (value: unknown, fallback: string): string => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string') {
    const timestamp = Date.parse(value);
    if (Number.isFinite(timestamp)) {
      return new Date(timestamp).toISOString();
    }
  }
  return fallback;
};

const sanitizeCachedEntry = (value: unknown): CachedSpeciesEntry | null => {
  if (isSpeciesProfile(value)) {
    const profile = normalizeSpeciesProfile(value as SpeciesProfile);
    return {
      profile,
      ttlDays: DEFAULT_SPECIES_TTL_DAYS,
      refreshedAt: profile.updatedAt,
      source: profile.source,
    };
  }

  if (typeof value !== 'object' || value === null) return null;

  const candidate = value as Record<string, unknown>;
  if (!isSpeciesProfile(candidate.profile)) return null;

  const profile = normalizeSpeciesProfile(candidate.profile as SpeciesProfile);
  const ttlDays = typeof candidate.ttlDays === 'number' && Number.isFinite(candidate.ttlDays)
    ? Math.max(1, Math.round(candidate.ttlDays))
    : DEFAULT_SPECIES_TTL_DAYS;
  const refreshedAt = normalizeRefreshedAt(candidate.refreshedAt, profile.updatedAt);
  const source = typeof candidate.source === 'string' ? (candidate.source as SpeciesProfile['source']) : profile.source;

  return {
    profile,
    ttlDays,
    refreshedAt,
    source,
  };
};

const sanitizeSpeciesCacheEntries = (
  input: Record<string, unknown>,
): { entries: Record<string, CachedSpeciesEntry>; invalidCount: number } => {
  const result: Record<string, CachedSpeciesEntry> = {};
  let invalidCount = 0;

  Object.values(input).forEach((value) => {
    const sanitized = sanitizeCachedEntry(value);
    if (sanitized) {
      result[sanitized.profile.speciesKey] = sanitized;
    } else {
      invalidCount += 1;
    }
  });

  return { entries: result, invalidCount };
};

const sanitizeSpeciesCache = (input: unknown): SanitizedSpeciesResult => {
  if (input === null || input === undefined) {
    return { entries: {}, migrated: false, invalidCount: 0, sourceVersion: null, futureVersion: null };
  }

  if (isPersistedSpeciesCachePayload(input)) {
    const { schemaVersion, entries } = input as PersistedSpeciesCachePayload;
    if (!Number.isFinite(schemaVersion)) {
      return { entries: {}, migrated: false, invalidCount: 0, sourceVersion: null, futureVersion: null };
    }
    if (schemaVersion > SPECIES_CACHE_SCHEMA_VERSION) {
      return {
        entries: {},
        migrated: false,
        invalidCount: 0,
        sourceVersion: schemaVersion,
        futureVersion: schemaVersion,
      };
    }
    const { entries: sanitized, invalidCount } = sanitizeSpeciesCacheEntries(entries);
    return {
      entries: sanitized,
      migrated: schemaVersion < SPECIES_CACHE_SCHEMA_VERSION,
      invalidCount,
      sourceVersion: schemaVersion,
      futureVersion: null,
    };
  }

  if (typeof input === 'object') {
    const candidate = input as Record<string, unknown>;
    const { entries, invalidCount } = sanitizeSpeciesCacheEntries(candidate);
    const hasLegacyKeys = Object.keys(candidate).some((key) => typeof key === 'string');
    return {
      entries,
      migrated: hasLegacyKeys,
      invalidCount,
      sourceVersion: null,
      futureVersion: null,
    };
  }

  return { entries: {}, migrated: false, invalidCount: 0, sourceVersion: null, futureVersion: null };
};

interface StoreOptions {
  storageKeys?: Partial<StorageKeys>;
}

type StoreListener = () => void;

export class PlantStore {
  private state: StoreState = { ...DEFAULT_STATE };
  private readonly keys: StorageKeys;
  private readonly listeners: Set<StoreListener> = new Set();

  constructor(private readonly storage: StorageAdapter, options: StoreOptions = {}) {
    this.keys = {
      ...DEFAULT_KEYS,
      ...options.storageKeys,
    };
  }

  subscribe(listener: StoreListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    if (this.listeners.size === 0) {
      return;
    }
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error('[PlantStore] Listener execution failed', error);
      }
    });
  }

  async hydrate(): Promise<void> {
    const [rawPlants, rawSpecies] = await Promise.all([
      this.storage.getItem(this.keys.plants),
      this.storage.getItem(this.keys.speciesCache),
    ]);

    const plantResult = sanitizePersistedPlants(rawPlants);
    const speciesResult = sanitizeSpeciesCache(rawSpecies);

    this.state = {
      plants: plantResult.plants,
      speciesCache: speciesResult.entries,
    };

    const expired = await this.purgeStaleSpecies();

    if (plantResult.futureVersion) {
      console.warn(
        `[PlantStore] Dropped plants stored with unsupported schema version ${plantResult.futureVersion}; clearing persisted data.`,
      );
      await this.storage.removeItem(this.keys.plants);
    } else {
      let shouldPersistPlants = false;
      if (plantResult.migrated) {
        console.info(
          `[PlantStore] Migrated plant storage from v${plantResult.sourceVersion ?? 'legacy'} to v${PLANTS_SCHEMA_VERSION}.`,
        );
        shouldPersistPlants = true;
      }
      if (plantResult.invalidCount > 0) {
        console.warn(`[PlantStore] Dropped ${plantResult.invalidCount} invalid plant record(s) during hydrate.`);
        shouldPersistPlants = true;
      }
      if (shouldPersistPlants) {
        await this.persistPlants();
      }
    }

    if (speciesResult.futureVersion) {
      console.warn(
        `[PlantStore] Dropped species cache stored with unsupported schema version ${speciesResult.futureVersion}; clearing persisted cache.`,
      );
      await this.storage.removeItem(this.keys.speciesCache);
      this.state.speciesCache = {};
    } else {
      let shouldPersistSpecies = false;
      if (speciesResult.migrated) {
        console.info(
          `[PlantStore] Migrated species cache from v${speciesResult.sourceVersion ?? 'legacy'} to v${SPECIES_CACHE_SCHEMA_VERSION}.`,
        );
        shouldPersistSpecies = true;
      }
      if (speciesResult.invalidCount > 0) {
        console.warn(
          `[PlantStore] Dropped ${speciesResult.invalidCount} invalid species cache entr${
            speciesResult.invalidCount === 1 ? 'y' : 'ies'
          } during hydrate.`,
        );
        shouldPersistSpecies = true;
      }
      if (expired.length > 0) {
        console.info(`[PlantStore] Purged ${expired.length} expired species cache entr${expired.length === 1 ? 'y' : 'ies'}.`);
      }
      if (shouldPersistSpecies && expired.length === 0) {
        await this.persistSpeciesCache();
      }
    }

    this.notifyListeners();
  }

  getState(): StoreState {
    return {
      plants: this.state.plants.map((plant) => clonePlant(this.withSpecies(plant))),
      speciesCache: Object.fromEntries(
        Object.entries(this.state.speciesCache).map(([key, entry]) => [key, cloneCachedSpeciesEntry(entry)]),
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
    return Object.values(this.state.speciesCache).map((entry) => cloneSpeciesProfile(entry.profile));
  }

  getSpeciesProfile(speciesKey: string): SpeciesProfile | undefined {
    const key = speciesKey.trim().toLowerCase();
    const entry = this.state.speciesCache[key];
    return entry ? cloneSpeciesProfile(entry.profile) : undefined;
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
    this.notifyListeners();
  }

  async removePlant(id: string): Promise<void> {
    const next = this.state.plants.filter((plant) => plant.id !== id);
    if (next.length === this.state.plants.length) return;
    this.state.plants = next;
    await this.persistPlants();
    this.notifyListeners();
  }

  async upsertSpeciesProfile(profile: SpeciesProfile, metadata: SpeciesCacheMetadata = {}): Promise<void> {
    const normalized = normalizeSpeciesProfile(profile);
    const ttlDays = metadata.ttlDays && Number.isFinite(metadata.ttlDays)
      ? Math.max(1, Math.round(metadata.ttlDays))
      : DEFAULT_SPECIES_TTL_DAYS;
    const refreshedAt = normalizeRefreshedAt(metadata.refreshedAt, normalized.updatedAt);
    const source = metadata.source ?? normalized.source;

    this.state.speciesCache[normalized.speciesKey] = {
      profile: { ...normalized, source },
      ttlDays,
      refreshedAt,
      source,
    };
    await this.persistSpeciesCache();
    this.notifyListeners();
  }

  async clear(): Promise<void> {
    this.state = { ...DEFAULT_STATE };
    await Promise.all([
      this.storage.removeItem(this.keys.plants),
      this.storage.removeItem(this.keys.speciesCache),
    ]);
    this.notifyListeners();
  }

  private withSpecies(plant: Plant): Plant {
    const cached = this.state.speciesCache[plant.speciesKey];
    return cached ? { ...plant, speciesProfile: cached.profile } : plant;
  }

  private async persistPlants(): Promise<void> {
    const plants = this.state.plants.map(({ speciesProfile, ...rest }) => ({
      ...rest,
      moisturePolicyOverride: rest.moisturePolicyOverride
        ? cloneMoisturePolicy(rest.moisturePolicyOverride)
        : undefined,
    }));
    const payload: PersistedPlantsPayload = {
      schemaVersion: PLANTS_SCHEMA_VERSION,
      plants,
    };
    await this.storage.setItem(this.keys.plants, payload);
  }

  private async persistSpeciesCache(): Promise<void> {
    const entries = Object.fromEntries(
      Object.entries(this.state.speciesCache).map(([key, entry]) => [
        key,
        {
          profile: cloneSpeciesProfile(entry.profile),
          ttlDays: entry.ttlDays,
          refreshedAt: entry.refreshedAt,
          source: entry.source,
        },
      ]),
    );
    const payload: PersistedSpeciesCachePayload = {
      schemaVersion: SPECIES_CACHE_SCHEMA_VERSION,
      entries,
    };
    await this.storage.setItem(this.keys.speciesCache, payload);
  }

  async purgeStaleSpecies(referenceDate: Date = new Date()): Promise<string[]> {
    const expired = this.removeExpiredSpecies(referenceDate.getTime());
    if (!expired.length) return [];
    await this.persistSpeciesCache();
    return expired;
  }

  private removeExpiredSpecies(referenceMs: number): string[] {
    const expired: string[] = [];
    Object.entries(this.state.speciesCache).forEach(([key, entry]) => {
      const refreshedMs = Date.parse(entry.refreshedAt);
      const ttlMs = entry.ttlDays * MS_PER_DAY;
      if (!Number.isFinite(refreshedMs) || referenceMs - refreshedMs >= ttlMs) {
        delete this.state.speciesCache[key];
        expired.push(key);
      }
    });
    return expired;
  }
}