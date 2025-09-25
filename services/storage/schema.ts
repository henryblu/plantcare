export const DEFAULT_STORAGE_NAMESPACE = 'smartplant';

export interface StorageKeys {
  plants: string;
  speciesCache: string;
}

export const createDefaultStorageKeys = (namespace: string = DEFAULT_STORAGE_NAMESPACE): StorageKeys => ({
  plants: `${namespace}:plants`,
  speciesCache: `${namespace}:species-cache`,
});

export const PLANTS_SCHEMA_VERSION = 1;
export const SPECIES_CACHE_SCHEMA_VERSION = 1;

export interface PersistedPlantsPayload<T = unknown> {
  schemaVersion: number;
  plants: T[];
}

export interface PersistedSpeciesCacheEntry {
  profile: unknown;
  ttlDays: number;
  refreshedAt: string;
  source: string;
}

export interface PersistedSpeciesCachePayload<T extends PersistedSpeciesCacheEntry = PersistedSpeciesCacheEntry> {
  schemaVersion: number;
  entries: Record<string, T>;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const isPersistedPlantsPayload = (value: unknown): value is PersistedPlantsPayload => {
  if (!isObject(value)) return false;
  if (!('schemaVersion' in value) || typeof value.schemaVersion !== 'number') return false;
  if (!Array.isArray(value.plants)) return false;
  return true;
};

export const isPersistedSpeciesCachePayload = (value: unknown): value is PersistedSpeciesCachePayload => {
  if (!isObject(value)) return false;
  if (!('schemaVersion' in value) || typeof value.schemaVersion !== 'number') return false;
  if (!isObject(value.entries)) return false;
  return true;
};

export const isPersistedSpeciesCacheEntry = (value: unknown): value is PersistedSpeciesCacheEntry => {
  if (!isObject(value)) return false;
  if (!('profile' in value)) return false;
  if (typeof value.ttlDays !== 'number' || !Number.isFinite(value.ttlDays)) return false;
  if (typeof value.refreshedAt !== 'string') return false;
  if (typeof value.source !== 'string') return false;
  return true;
};

const createInvalidPayloadError = (key: string, reason: string): Error =>
  new Error(`Invalid payload for key "${key}": ${reason}`);

export const validatePersistedPlantsPayload = (
  key: string,
  value: unknown,
): PersistedPlantsPayload => {
  if (!isPersistedPlantsPayload(value)) {
    throw createInvalidPayloadError(key, 'expected { schemaVersion, plants[] } payload');
  }

  const invalidEntry = value.plants.find((plant) => !isObject(plant) || typeof plant.id !== 'string');
  if (invalidEntry) {
    throw createInvalidPayloadError(key, 'plant records must include an "id" string');
  }

  return value;
};

export const validatePersistedSpeciesPayload = (
  key: string,
  value: unknown,
): PersistedSpeciesCachePayload => {
  if (!isPersistedSpeciesCachePayload(value)) {
    throw createInvalidPayloadError(key, 'expected { schemaVersion, entries{} } payload');
  }

  const invalidEntry = Object.entries(value.entries).find(([, entry]) => !isPersistedSpeciesCacheEntry(entry));
  if (invalidEntry) {
    throw createInvalidPayloadError(key, 'species cache entries must include profile, ttlDays, refreshedAt, and source');
  }

  return value;
};

const METADATA_SUFFIX = '__meta';

export const createSchemaMetadataKey = (storageKey: string): string => `${storageKey}${METADATA_SUFFIX}`;
