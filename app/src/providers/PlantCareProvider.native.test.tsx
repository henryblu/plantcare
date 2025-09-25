/**
 * @vitest-environment jsdom
 */

import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { PlantCareProvider, usePlantCareServices } from './PlantCareProvider';
import {
  PLANTS_SCHEMA_VERSION,
  SPECIES_CACHE_SCHEMA_VERSION,
  type PersistedPlantsPayload,
  type PersistedSpeciesCachePayload,
} from '@services/storage/schema';

class MockAsyncStorage {
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
}

const TestConsumer = () => {
  const { hydrated, store } = usePlantCareServices();
  const plants = store.listPlants();
  const species = store.listSpeciesProfiles();
  return (
    <div>
      <span data-testid="hydrated">{hydrated ? 'true' : 'false'}</span>
      <span data-testid="plant-count">{plants.length}</span>
      <span data-testid="species-count">{species.length}</span>
    </div>
  );
};

describe('PlantCareProvider async storage integration', () => {
  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete (globalThis as Record<string, unknown>).__PLANTCARE_ASYNC_STORAGE__;
  });

  it('hydrates plants and species cache from async storage', async () => {
    const asyncStorage = new MockAsyncStorage();
    const now = new Date('2025-01-01T00:00:00.000Z');
    const plants: PersistedPlantsPayload<Record<string, unknown>> = {
      schemaVersion: PLANTS_SCHEMA_VERSION,
      plants: [
        {
          id: 'plant-1',
          speciesKey: 'ficus-lyrata',
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      ],
    };

    const species: PersistedSpeciesCachePayload = {
      schemaVersion: SPECIES_CACHE_SCHEMA_VERSION,
      entries: {
        'ficus-lyrata': {
          profile: {
            speciesKey: 'ficus-lyrata',
            canonicalName: 'Ficus lyrata',
            commonName: 'Fiddle-leaf fig',
            type: 'tropical',
            moisturePolicy: {
              waterIntervalDays: 7,
              soilMoistureThreshold: 35,
              humidityPreference: 'medium',
              lightRequirement: 'bright-indirect',
              notes: [],
            },
            source: 'chatgpt',
            updatedAt: now.toISOString(),
            createdAt: now.toISOString(),
          },
          ttlDays: 365,
          refreshedAt: now.toISOString(),
          source: 'chatgpt',
        },
      },
    };

    await asyncStorage.setItem('smartplant:plants', JSON.stringify(plants as PersistedPlantsPayload));
    await asyncStorage.setItem('smartplant:species-cache', JSON.stringify(species));

    (globalThis as Record<string, unknown>).__PLANTCARE_ASYNC_STORAGE__ = asyncStorage;

    render(
      <PlantCareProvider
        identificationProvider={null}
        policyService={null}
        plantNetConfigured={false}
        openAiConfigured={false}
      >
        <TestConsumer />
      </PlantCareProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('hydrated').textContent).toBe('true'));
    await waitFor(() => expect(screen.getByTestId('plant-count').textContent).toBe('1'));
    await waitFor(() => expect(screen.getByTestId('species-count').textContent).toBe('1'));
  });
});
