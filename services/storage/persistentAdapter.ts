import { createJsonStorage, type KeyValueStorage, type StorageAdapter } from './adapter';
import {
  createDefaultStorageKeys,
  createSchemaMetadataKey,
  DEFAULT_STORAGE_NAMESPACE,
  PLANTS_SCHEMA_VERSION,
  SPECIES_CACHE_SCHEMA_VERSION,
  type StorageKeys,
  validatePersistedPlantsPayload,
  validatePersistedSpeciesPayload,
  type PersistedPlantsPayload,
  type PersistedSpeciesCachePayload,
} from './schema';

export interface AsyncStorageLike {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface PersistentStorageOptions {
  namespace?: string;
  keys?: Partial<StorageKeys>;
}

const ensureAsync = <T>(value: Promise<T> | T): Promise<T> =>
  value instanceof Promise ? value : Promise.resolve(value);

export const createAsyncStorageAdapter = (
  storage: AsyncStorageLike,
  options: PersistentStorageOptions = {},
): StorageAdapter => {
  const namespace = options.namespace ?? DEFAULT_STORAGE_NAMESPACE;
  const keys = options.keys
    ? { ...createDefaultStorageKeys(namespace), ...options.keys }
    : createDefaultStorageKeys(namespace);
  const keyValue: KeyValueStorage = {
    getItem: (key: string) => ensureAsync(storage.getItem(key)),
    setItem: (key: string, value: string) => ensureAsync(storage.setItem(key, value)),
    removeItem: (key: string) => ensureAsync(storage.removeItem(key)),
  };

  const adapter = createJsonStorage(keyValue);

  return {
    async getItem<T = unknown>(key: string): Promise<T | null> {
      return adapter.getItem<T>(key);
    },
    async setItem<T>(key: string, value: T): Promise<void> {
      if (key === keys.plants) {
        validatePersistedPlantsPayload(key, value);
      } else if (key === keys.speciesCache) {
        validatePersistedSpeciesPayload(key, value);
      }
      await adapter.setItem(key, value);
    },
    async removeItem(key: string): Promise<void> {
      await adapter.removeItem(key);
    },
  };
};

export interface SqliteRow {
  [column: string]: unknown;
}

export interface SqliteExecutor {
  execute(sql: string, params?: unknown[]): Promise<void>;
  select<T extends SqliteRow = SqliteRow>(sql: string, params?: unknown[]): Promise<T[]>;
}

const TRANSACTION_BEGIN = 'BEGIN IMMEDIATE';
const TRANSACTION_COMMIT = 'COMMIT';
const TRANSACTION_ROLLBACK = 'ROLLBACK';

interface SqliteAdapterContext {
  executor: SqliteExecutor;
  namespace: string;
  keys: StorageKeys;
  ready: Promise<void>;
}

const createSqliteSchema = async (executor: SqliteExecutor): Promise<void> => {
  await executor.execute(
    'CREATE TABLE IF NOT EXISTS plants (namespace TEXT NOT NULL, plant_id TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(namespace, plant_id))',
  );
  await executor.execute(
    'CREATE TABLE IF NOT EXISTS species_cache (namespace TEXT NOT NULL, species_key TEXT NOT NULL, payload TEXT NOT NULL, ttl_days INTEGER NOT NULL, refreshed_at TEXT NOT NULL, source TEXT NOT NULL, PRIMARY KEY(namespace, species_key))',
  );
  await executor.execute(
    'CREATE TABLE IF NOT EXISTS kv_store (namespace TEXT NOT NULL, key TEXT NOT NULL, payload TEXT, PRIMARY KEY(namespace, key))',
  );
};

const runTransaction = async (executor: SqliteExecutor, fn: () => Promise<void>): Promise<void> => {
  await executor.execute(TRANSACTION_BEGIN);
  try {
    await fn();
    await executor.execute(TRANSACTION_COMMIT);
  } catch (error) {
    await executor.execute(TRANSACTION_ROLLBACK).catch(() => undefined);
    throw error;
  }
};

const serialize = (value: unknown): string => {
  try {
    return JSON.stringify(value ?? null);
  } catch (error) {
    throw new Error(`Failed to serialise value: ${(error as Error).message}`);
  }
};

const parseJson = <T>(payload: unknown, context: string): T => {
  if (typeof payload !== 'string') {
    throw new Error(`Expected string payload for ${context}`);
  }
  try {
    return JSON.parse(payload) as T;
  } catch (error) {
    throw new Error(`Failed to parse JSON for ${context}: ${(error as Error).message}`);
  }
};

const createSqliteContext = (
  executor: SqliteExecutor,
  options: PersistentStorageOptions,
): SqliteAdapterContext => {
  const namespace = options.namespace ?? DEFAULT_STORAGE_NAMESPACE;
  const keys = options.keys ? { ...createDefaultStorageKeys(namespace), ...options.keys } : createDefaultStorageKeys(namespace);
  const ready = createSqliteSchema(executor);
  return { executor, namespace, keys, ready };
};

interface SchemaMetadata {
  schemaVersion?: number;
}

const writeMetadata = async (ctx: SqliteAdapterContext, key: string, value: unknown): Promise<void> => {
  await ctx.executor.execute(
    'INSERT OR REPLACE INTO kv_store(namespace, key, payload) VALUES (?, ?, ?)',
    [ctx.namespace, createSchemaMetadataKey(key), serialize(value)],
  );
};

const readMetadata = async <T>(ctx: SqliteAdapterContext, key: string, context: string): Promise<T | null> => {
  const rows = await ctx.executor.select<{ payload: string }>(
    'SELECT payload FROM kv_store WHERE namespace = ? AND key = ? LIMIT 1',
    [ctx.namespace, createSchemaMetadataKey(key)],
  );
  if (!rows.length) return null;
  return parseJson<T>(rows[0].payload, context);
};

const clearMetadata = async (ctx: SqliteAdapterContext, key: string): Promise<void> => {
  await ctx.executor.execute('DELETE FROM kv_store WHERE namespace = ? AND key = ?', [
    ctx.namespace,
    createSchemaMetadataKey(key),
  ]);
};

const setPlants = async (ctx: SqliteAdapterContext, value: unknown): Promise<void> => {
  const payload = validatePersistedPlantsPayload(ctx.keys.plants, value) as PersistedPlantsPayload;
  await runTransaction(ctx.executor, async () => {
    await ctx.executor.execute('DELETE FROM plants WHERE namespace = ?', [ctx.namespace]);
    for (const plant of payload.plants) {
      const record = plant as Record<string, unknown>;
      const id = record?.id;
      if (typeof id !== 'string') continue;
      const serialized = serialize({ schemaVersion: payload.schemaVersion, plant });
      await ctx.executor.execute(
        'INSERT OR REPLACE INTO plants(namespace, plant_id, payload) VALUES (?, ?, ?)',
        [ctx.namespace, id, serialized],
      );
    }
    await writeMetadata(ctx, ctx.keys.plants, { schemaVersion: payload.schemaVersion });
  });
};

const setSpecies = async (ctx: SqliteAdapterContext, value: unknown): Promise<void> => {
  const payload = validatePersistedSpeciesPayload(ctx.keys.speciesCache, value) as PersistedSpeciesCachePayload;
  await runTransaction(ctx.executor, async () => {
    await ctx.executor.execute('DELETE FROM species_cache WHERE namespace = ?', [ctx.namespace]);
    for (const [speciesKey, entry] of Object.entries(payload.entries)) {
      if (!speciesKey) continue;
      const serialized = serialize({ schemaVersion: payload.schemaVersion, profile: entry.profile });
      await ctx.executor.execute(
        'INSERT OR REPLACE INTO species_cache(namespace, species_key, payload, ttl_days, refreshed_at, source) VALUES (?, ?, ?, ?, ?, ?)',
        [ctx.namespace, speciesKey, serialized, entry.ttlDays, entry.refreshedAt, entry.source],
      );
    }
    await writeMetadata(ctx, ctx.keys.speciesCache, { schemaVersion: payload.schemaVersion });
  });
};

const setKeyValue = async (ctx: SqliteAdapterContext, key: string, value: unknown): Promise<void> => {
  const payload = serialize(value);
  await ctx.executor.execute(
    'INSERT OR REPLACE INTO kv_store(namespace, key, payload) VALUES (?, ?, ?)',
    [ctx.namespace, key, payload],
  );
};

const getPlants = async (ctx: SqliteAdapterContext): Promise<unknown> => {
  const rows = await ctx.executor.select<{ payload: string }>(
    'SELECT payload FROM plants WHERE namespace = ? ORDER BY plant_id',
    [ctx.namespace],
  );
  const metadata = await readMetadata<SchemaMetadata>(ctx, ctx.keys.plants, 'plants metadata');
  if (!rows.length) {
    if (!metadata) return null;
    const schemaVersion = typeof metadata.schemaVersion === 'number' ? metadata.schemaVersion : PLANTS_SCHEMA_VERSION;
    return { schemaVersion, plants: [] } satisfies PersistedPlantsPayload;
  }

  const plants: unknown[] = [];
  let detectedSchema: number | null = null;

  rows.forEach((row, index) => {
    const parsed = parseJson<Record<string, unknown> | unknown>(row.payload, `plant row ${index}`);
    if (parsed && typeof parsed === 'object' && 'plant' in parsed) {
      const record = parsed as Record<string, unknown>;
      if (typeof record.schemaVersion === 'number' && Number.isFinite(record.schemaVersion)) {
        detectedSchema = detectedSchema ?? (record.schemaVersion as number);
      }
      plants.push(record.plant);
    } else {
      plants.push(parsed);
    }
  });

  const schemaVersion =
    typeof metadata?.schemaVersion === 'number' && Number.isFinite(metadata.schemaVersion)
      ? metadata.schemaVersion
      : detectedSchema ?? PLANTS_SCHEMA_VERSION;

  return { schemaVersion, plants } satisfies PersistedPlantsPayload;
};

const getSpecies = async (ctx: SqliteAdapterContext): Promise<unknown> => {
  const rows = await ctx.executor.select<{
    species_key: string;
    payload: string;
    ttl_days: number;
    refreshed_at: string;
    source: string;
  }>('SELECT species_key, payload, ttl_days, refreshed_at, source FROM species_cache WHERE namespace = ?', [ctx.namespace]);

  const metadata = await readMetadata<SchemaMetadata>(ctx, ctx.keys.speciesCache, 'species metadata');

  if (!rows.length) {
    if (!metadata) return null;
    const schemaVersion = typeof metadata.schemaVersion === 'number' ? metadata.schemaVersion : SPECIES_CACHE_SCHEMA_VERSION;
    return { schemaVersion, entries: {} } satisfies PersistedSpeciesCachePayload;
  }

  const entries: PersistedSpeciesCachePayload['entries'] = {};
  let detectedSchema: number | null = null;

  rows.forEach((row, index) => {
    const parsed = parseJson<Record<string, unknown> | unknown>(row.payload, `species row ${index}`);
    let profile: unknown = parsed;
    if (parsed && typeof parsed === 'object' && 'profile' in parsed) {
      const record = parsed as Record<string, unknown>;
      if (typeof record.schemaVersion === 'number' && Number.isFinite(record.schemaVersion)) {
        detectedSchema = detectedSchema ?? (record.schemaVersion as number);
      }
      profile = record.profile;
    }

    entries[row.species_key] = {
      profile,
      ttlDays: typeof row.ttl_days === 'number' ? row.ttl_days : Number(row.ttl_days ?? 0),
      refreshedAt: typeof row.refreshed_at === 'string' ? row.refreshed_at : String(row.refreshed_at ?? ''),
      source: typeof row.source === 'string' ? row.source : String(row.source ?? ''),
    };
  });

  const schemaVersion =
    typeof metadata?.schemaVersion === 'number' && Number.isFinite(metadata.schemaVersion)
      ? metadata.schemaVersion
      : detectedSchema ?? SPECIES_CACHE_SCHEMA_VERSION;

  return { schemaVersion, entries } satisfies PersistedSpeciesCachePayload;
};

const getKeyValue = async (ctx: SqliteAdapterContext, key: string): Promise<unknown> => {
  const rows = await ctx.executor.select<{ payload: string }>(
    'SELECT payload FROM kv_store WHERE namespace = ? AND key = ? LIMIT 1',
    [ctx.namespace, key],
  );
  if (!rows.length) return null;
  return parseJson(rows[0].payload, `kv key "${key}"`);
};

const removePlants = async (ctx: SqliteAdapterContext): Promise<void> => {
  await ctx.executor.execute('DELETE FROM plants WHERE namespace = ?', [ctx.namespace]);
  await clearMetadata(ctx, ctx.keys.plants);
};

const removeSpecies = async (ctx: SqliteAdapterContext): Promise<void> => {
  await ctx.executor.execute('DELETE FROM species_cache WHERE namespace = ?', [ctx.namespace]);
  await clearMetadata(ctx, ctx.keys.speciesCache);
};

const removeKeyValue = async (ctx: SqliteAdapterContext, key: string): Promise<void> => {
  await ctx.executor.execute('DELETE FROM kv_store WHERE namespace = ? AND key = ?', [ctx.namespace, key]);
};

export const createSQLiteStorageAdapter = (
  executor: SqliteExecutor,
  options: PersistentStorageOptions = {},
): StorageAdapter => {
  const context = createSqliteContext(executor, options);

  return {
    async getItem<T = unknown>(key: string): Promise<T | null> {
      await context.ready;
      if (key === context.keys.plants) {
        return (await getPlants(context)) as T;
      }
      if (key === context.keys.speciesCache) {
        return (await getSpecies(context)) as T;
      }
      return (await getKeyValue(context, key)) as T | null;
    },
    async setItem<T>(key: string, value: T): Promise<void> {
      await context.ready;
      if (key === context.keys.plants) {
        await setPlants(context, value);
        return;
      }
      if (key === context.keys.speciesCache) {
        await setSpecies(context, value);
        return;
      }
      await setKeyValue(context, key, value);
    },
    async removeItem(key: string): Promise<void> {
      await context.ready;
      if (key === context.keys.plants) {
        await removePlants(context);
        return;
      }
      if (key === context.keys.speciesCache) {
        await removeSpecies(context);
        return;
      }
      await removeKeyValue(context, key);
    },
  };
};
