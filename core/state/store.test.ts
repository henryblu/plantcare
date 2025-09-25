import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlantStore, type CachedSpeciesEntry } from './store';
import { createMemoryStorage } from '../../services/storage/memoryAdapter';
import type { SpeciesProfile } from '../models/speciesProfile';
import {
  PLANTS_SCHEMA_VERSION,
  SPECIES_CACHE_SCHEMA_VERSION,
  type PersistedSpeciesCachePayload,
  type PersistedPlantsPayload,
} from '../../services/storage/schema';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const createProfile = (overrides: Partial<SpeciesProfile> = {}): SpeciesProfile => ({
  speciesKey: 'ficus-lyrata',
  canonicalName: 'Ficus lyrata',
  commonName: 'Fiddle-leaf fig',
  type: 'tropical',
  moisturePolicy: {
    waterIntervalDays: 7,
    soilMoistureThreshold: 35,
    humidityPreference: 'medium',
    lightRequirement: 'bright-indirect',
    notes: ['Avoid drafts'],
  },
  source: 'chatgpt',
  updatedAt: new Date().toISOString(),
  createdAt: new Date(Date.now() - MS_PER_DAY).toISOString(),
  ...overrides,
});

const toCacheEntry = (profile: SpeciesProfile, overrides: Partial<CachedSpeciesEntry> = {}): CachedSpeciesEntry => ({
  profile,
  ttlDays: 30,
  refreshedAt: profile.updatedAt,
  source: profile.source,
  ...overrides,
});

describe('PlantStore storage hydration', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('drops expired species records during hydrate', async () => {
    const storage = createMemoryStorage();
    const freshProfile = createProfile({
      speciesKey: 'epipremnum-aureum',
      canonicalName: 'Epipremnum aureum',
      updatedAt: new Date('2024-03-01T00:00:00.000Z').toISOString(),
    });
    const staleProfile = createProfile({
      speciesKey: 'ficus-lyrata',
      canonicalName: 'Ficus lyrata',
      updatedAt: new Date('2023-01-01T00:00:00.000Z').toISOString(),
    });

    await storage.setItem('smartplant:species-cache', {
      schemaVersion: SPECIES_CACHE_SCHEMA_VERSION,
      entries: {
        'epipremnum-aureum': toCacheEntry(freshProfile, { refreshedAt: new Date().toISOString() }),
        'ficus-lyrata': toCacheEntry(staleProfile, {
          ttlDays: 1,
          refreshedAt: new Date('2023-01-02T00:00:00.000Z').toISOString(),
        }),
      },
    } satisfies PersistedSpeciesCachePayload);

    const store = new PlantStore(storage);
    await store.hydrate();

    expect(store.getSpeciesProfile('ficus-lyrata')).toBeUndefined();
    const pothos = store.getSpeciesProfile('epipremnum-aureum');
    expect(pothos?.canonicalName).toBe('Epipremnum aureum');

    const snapshot = storage.snapshot();
    const cache = snapshot['smartplant:species-cache'] as PersistedSpeciesCachePayload;
    expect(cache).toBeDefined();
    expect(cache.schemaVersion).toBe(SPECIES_CACHE_SCHEMA_VERSION);
    expect(Object.keys(cache.entries)).toEqual(['epipremnum-aureum']);
  });

  it('migrates legacy species cache entries without metadata', async () => {
    const storage = createMemoryStorage();
    const legacy = createProfile({
      speciesKey: 'monstera-deliciosa',
      canonicalName: 'Monstera deliciosa',
      updatedAt: new Date(Date.now() - 10 * MS_PER_DAY).toISOString(),
    });

    await storage.setItem('smartplant:species-cache', {
      'monstera-deliciosa': legacy,
    });

    const store = new PlantStore(storage);
    await store.hydrate();

    const state = store.getState();
    const entry = state.speciesCache['monstera-deliciosa'];
    expect(entry).toBeDefined();
    expect(entry.ttlDays).toBeGreaterThan(0);
    expect(entry.refreshedAt).toBe(legacy.updatedAt);
    expect(entry.source).toBe(legacy.source);
  });
});

describe('PlantStore TTL utilities', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('persists refreshed metadata when upserting', async () => {
    const storage = createMemoryStorage();
    const store = new PlantStore(storage);
    await store.hydrate();

    const profile = createProfile({
      speciesKey: 'calathea-ornata',
      canonicalName: 'Calathea ornata',
    });

    const refreshedAt = new Date('2024-05-01T12:00:00.000Z');
    await store.upsertSpeciesProfile(profile, {
      ttlDays: 45,
      refreshedAt,
      source: 'cache',
    });

    const state = store.getState();
    const entry = state.speciesCache['calathea-ornata'];
    expect(entry).toBeDefined();
    expect(entry.ttlDays).toBe(45);
    expect(entry.refreshedAt).toBe(refreshedAt.toISOString());
    expect(entry.source).toBe('cache');

    const snapshot = storage.snapshot();
    const payload = snapshot['smartplant:species-cache'] as PersistedSpeciesCachePayload;
    expect(payload.schemaVersion).toBe(SPECIES_CACHE_SCHEMA_VERSION);
    expect(payload.entries['calathea-ornata']?.ttlDays).toBe(45);
  });

  it('purges stale species entries on demand', async () => {
    const storage = createMemoryStorage();
    const store = new PlantStore(storage);
    await store.hydrate();

    const now = new Date('2024-06-01T00:00:00.000Z');
    await store.upsertSpeciesProfile(
      createProfile({
        speciesKey: 'aglaonema-siam-aurora',
        canonicalName: 'Aglaonema "Siam Aurora"',
      }),
      {
        ttlDays: 30,
        refreshedAt: new Date('2024-05-20T00:00:00.000Z'),
      },
    );

    await store.upsertSpeciesProfile(
      createProfile({
        speciesKey: 'dracaena-marginata',
        canonicalName: 'Dracaena marginata',
      }),
      {
        ttlDays: 5,
        refreshedAt: new Date('2024-05-10T00:00:00.000Z'),
      },
    );

    const removed = await store.purgeStaleSpecies(now);
    expect(removed.sort()).toEqual(['dracaena-marginata']);

    const state = store.getState();
    expect(state.speciesCache['dracaena-marginata']).toBeUndefined();
    expect(state.speciesCache['aglaonema-siam-aurora']).toBeDefined();
  });
});

describe('PlantStore legacy plant migration', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('wraps legacy plant arrays in a schema payload on hydrate', async () => {
    const storage = createMemoryStorage();
    const legacyPlant = {
      id: 'plant-1',
      nickname: 'Rex',
      speciesKey: 'ficus-lyrata',
      createdAt: new Date('2024-01-01T00:00:00.000Z').toISOString(),
      updatedAt: new Date('2024-01-02T00:00:00.000Z').toISOString(),
      photoUri: 'file://rex.jpg',
    };

    await storage.setItem('smartplant:plants', [legacyPlant]);

    const store = new PlantStore(storage);
    await store.hydrate();

    expect(store.listPlants()).toHaveLength(1);

    const payload = storage.snapshot()['smartplant:plants'] as PersistedPlantsPayload;
    expect(payload.schemaVersion).toBe(PLANTS_SCHEMA_VERSION);
    expect(payload.plants).toHaveLength(1);
    expect((payload.plants[0] as { id: string }).id).toBe('plant-1');
  });
});
