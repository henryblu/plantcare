import { describe, expect, it } from 'vitest';
import {
  createAsyncStorageAdapter,
  createSQLiteStorageAdapter,
  type AsyncStorageLike,
  type SqliteExecutor,
} from './persistentAdapter';
import {
  PLANTS_SCHEMA_VERSION,
  SPECIES_CACHE_SCHEMA_VERSION,
  createSchemaMetadataKey,
  type PersistedPlantsPayload,
  type PersistedSpeciesCachePayload,
} from './schema';

class MemoryAsyncStorage implements AsyncStorageLike {
  private readonly store = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.store.delete(key);
  }

  snapshot(): Record<string, string> {
    return Object.fromEntries(this.store.entries());
  }
}

interface PlantRow {
  plantId: string;
  payload: string;
}

interface SpeciesRow {
  speciesKey: string;
  payload: string;
  ttlDays: number;
  refreshedAt: string;
  source: string;
}

class MockSqliteExecutor implements SqliteExecutor {
  private readonly plants = new Map<string, Map<string, PlantRow>>();
  private readonly species = new Map<string, Map<string, SpeciesRow>>();
  private readonly kv = new Map<string, Map<string, string>>();

  async execute(sql: string, params: unknown[] = []): Promise<void> {
    const statement = sql.trim();
    if (statement.startsWith('CREATE TABLE')) {
      return;
    }
    if (statement === 'BEGIN IMMEDIATE' || statement === 'COMMIT' || statement === 'ROLLBACK') {
      return;
    }

    if (statement.startsWith('DELETE FROM plants')) {
      const namespace = params[0] as string;
      this.plants.delete(namespace);
      return;
    }

    if (statement.startsWith('DELETE FROM species_cache')) {
      const namespace = params[0] as string;
      this.species.delete(namespace);
      return;
    }

    if (statement.startsWith('DELETE FROM kv_store')) {
      const [namespace, key] = params as [string, string];
      const store = this.kv.get(namespace);
      if (store) {
        store.delete(key);
      }
      return;
    }

    if (statement.startsWith('INSERT OR REPLACE INTO plants')) {
      const [namespace, plantId, payload] = params as [string, string, string];
      const table = this.plants.get(namespace) ?? new Map<string, PlantRow>();
      table.set(plantId, { plantId, payload });
      this.plants.set(namespace, table);
      return;
    }

    if (statement.startsWith('INSERT OR REPLACE INTO species_cache')) {
      const [namespace, speciesKey, payload, ttlDays, refreshedAt, source] = params as [
        string,
        string,
        string,
        number,
        string,
        string,
      ];
      const table = this.species.get(namespace) ?? new Map<string, SpeciesRow>();
      table.set(speciesKey, { speciesKey, payload, ttlDays, refreshedAt, source });
      this.species.set(namespace, table);
      return;
    }

    if (statement.startsWith('INSERT OR REPLACE INTO kv_store')) {
      const [namespace, key, payload] = params as [string, string, string];
      const table = this.kv.get(namespace) ?? new Map<string, string>();
      table.set(key, payload);
      this.kv.set(namespace, table);
      return;
    }

    throw new Error(`Unsupported SQL statement: ${statement}`);
  }

  async select<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const statement = sql.trim();
    if (statement.startsWith('SELECT payload FROM plants')) {
      const namespace = params[0] as string;
      const table = this.plants.get(namespace);
      if (!table) return [];
      const rows = Array.from(table.values()).sort((a, b) => a.plantId.localeCompare(b.plantId));
      return rows.map((row) => ({ payload: row.payload })) as T[];
    }

    if (statement.startsWith('SELECT species_key, payload, ttl_days')) {
      const namespace = params[0] as string;
      const table = this.species.get(namespace);
      if (!table) return [];
      return Array.from(table.values()).map((row) => ({
        species_key: row.speciesKey,
        payload: row.payload,
        ttl_days: row.ttlDays,
        refreshed_at: row.refreshedAt,
        source: row.source,
      })) as T[];
    }

    if (statement.startsWith('SELECT payload FROM kv_store')) {
      const [namespace, key] = params as [string, string];
      const table = this.kv.get(namespace);
      if (!table) return [];
      const payload = table.get(key);
      return payload ? ([{ payload }] as T[]) : [];
    }

    throw new Error(`Unsupported SELECT statement: ${statement}`);
  }
}

describe('persistentAdapter validation', () => {
  it('rejects invalid plant payloads for async storage', async () => {
    const storage = new MemoryAsyncStorage();
    const adapter = createAsyncStorageAdapter(storage);

    await expect(adapter.setItem('smartplant:plants', [])).rejects.toThrowError(/Invalid payload/);

    const valid: PersistedPlantsPayload<Record<string, unknown>> = {
      schemaVersion: PLANTS_SCHEMA_VERSION,
      plants: [
        {
          id: 'p1',
          speciesKey: 'ficus',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    };

    await adapter.setItem('smartplant:plants', valid as PersistedPlantsPayload);
    const snapshot = storage.snapshot();
    expect(JSON.parse(snapshot['smartplant:plants'])).toMatchObject({ schemaVersion: PLANTS_SCHEMA_VERSION });
  });

  it('rejects species cache writes missing metadata', async () => {
    const storage = new MemoryAsyncStorage();
    const adapter = createAsyncStorageAdapter(storage);

    await expect(adapter.setItem('smartplant:species-cache', { foo: 'bar' })).rejects.toThrowError(/Invalid payload/);

    const valid: PersistedSpeciesCachePayload = {
      schemaVersion: SPECIES_CACHE_SCHEMA_VERSION,
      entries: {
        ficus: {
          profile: { speciesKey: 'ficus', canonicalName: 'Ficus', commonName: 'Fig' },
          ttlDays: 30,
          refreshedAt: new Date().toISOString(),
          source: 'cache',
        },
      },
    };

    await adapter.setItem('smartplant:species-cache', valid);
    expect(storage.snapshot()['smartplant:species-cache']).toBeDefined();
  });
});

describe('persistentAdapter sqlite integration', () => {
  it('persists and hydrates plants with schema metadata', async () => {
    const executor = new MockSqliteExecutor();
    const adapter = createSQLiteStorageAdapter(executor);

    const payload: PersistedPlantsPayload<Record<string, unknown>> = {
      schemaVersion: PLANTS_SCHEMA_VERSION,
      plants: [
        {
          id: 'p1',
          speciesKey: 'ficus',
          createdAt: new Date('2024-01-01T00:00:00.000Z').toISOString(),
          updatedAt: new Date('2024-01-01T00:00:00.000Z').toISOString(),
          type: 'tropical',
        },
      ],
    };

    await adapter.setItem('smartplant:plants', payload as PersistedPlantsPayload);

    const stored = (await adapter.getItem<PersistedPlantsPayload>('smartplant:plants'))!;
    expect(stored.schemaVersion).toBe(PLANTS_SCHEMA_VERSION);
    expect(stored.plants).toHaveLength(1);

    await adapter.removeItem('smartplant:plants');
    const metadata = await executor.select<{ payload: string }>(
      'SELECT payload FROM kv_store WHERE namespace = ? AND key = ? LIMIT 1',
      ['smartplant', createSchemaMetadataKey('smartplant:plants')],
    );
    expect(metadata).toHaveLength(0);
  });

  it('persists species cache rows and exposes metadata during reads', async () => {
    const executor = new MockSqliteExecutor();
    const adapter = createSQLiteStorageAdapter(executor);

    const payload: PersistedSpeciesCachePayload = {
      schemaVersion: SPECIES_CACHE_SCHEMA_VERSION,
      entries: {
        'ficus-lyrata': {
          profile: { speciesKey: 'ficus-lyrata', canonicalName: 'Ficus lyrata' },
          ttlDays: 60,
          refreshedAt: new Date('2024-02-01T00:00:00.000Z').toISOString(),
          source: 'chatgpt',
        },
      },
    };

    await adapter.setItem('smartplant:species-cache', payload);

    const stored = (await adapter.getItem<PersistedSpeciesCachePayload>('smartplant:species-cache'))!;
    expect(stored.schemaVersion).toBe(SPECIES_CACHE_SCHEMA_VERSION);
    expect(Object.keys(stored.entries)).toEqual(['ficus-lyrata']);

    await adapter.removeItem('smartplant:species-cache');
    const metadata = await executor.select<{ payload: string }>(
      'SELECT payload FROM kv_store WHERE namespace = ? AND key = ? LIMIT 1',
      ['smartplant', createSchemaMetadataKey('smartplant:species-cache')],
    );
    expect(metadata).toHaveLength(0);
  });
});
