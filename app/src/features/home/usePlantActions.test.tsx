/**
 * @vitest-environment jsdom
 */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlantStore } from "@core/state/store";
import { createMemoryStorage } from "@services/storage/memoryAdapter";
import type { Plant } from "@core/models/plant";
import type { SpeciesProfile } from "@core/models/speciesProfile";
import usePlantActions from "./usePlantActions";

const basePlant = (overrides: Partial<Plant> = {}): Plant => ({
  id: "plant-1",
  speciesKey: "ficus-lyrata",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  ...overrides,
});

const createProfile = (overrides: Partial<SpeciesProfile> = {}): SpeciesProfile => ({
  speciesKey: "ficus-lyrata",
  canonicalName: "Ficus lyrata",
  commonName: "Fiddle leaf fig",
  type: "tropical",
  moisturePolicy: {
    waterIntervalDays: 7,
    soilMoistureThreshold: 35,
    humidityPreference: "medium",
    lightRequirement: "bright-indirect",
    notes: ["Mist weekly"],
  },
  source: "seed",
  updatedAt: "2024-01-01T00:00:00.000Z",
  ...overrides,
});

describe("usePlantActions", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("persists nickname updates when renaming", async () => {
    const store = new PlantStore(createMemoryStorage());
    await store.hydrate();
    await store.upsertPlant(basePlant({ nickname: "Figgy" }));

    const { result } = renderHook(() =>
      usePlantActions({ store, resolvePolicy: null, speciesProfiles: {} }),
    );

    await act(async () => {
      await result.current.renamePlant("plant-1", "Kitchen Fig");
    });

    const renamed = store.getPlant("plant-1");
    expect(renamed?.nickname).toBe("Kitchen Fig");
  });

  it("removes a plant and restores it on undo", async () => {
    const store = new PlantStore(createMemoryStorage());
    await store.hydrate();
    const plant = basePlant();
    await store.upsertPlant(plant);

    const { result } = renderHook(() =>
      usePlantActions({ store, resolvePolicy: null, speciesProfiles: {} }),
    );

    await act(async () => {
      await result.current.deletePlant(plant.id);
    });

    expect(store.getPlant(plant.id)).toBeUndefined();
    expect(result.current.undoState).not.toBeNull();

    await act(async () => {
      await result.current.undoDelete();
    });

    const restored = store.getPlant(plant.id);
    expect(restored?.id).toBe(plant.id);
  });

  it("updates environment, notes, and refreshes policy when editing", async () => {
    const store = new PlantStore(createMemoryStorage());
    await store.hydrate();
    const profile = createProfile();
    await store.upsertSpeciesProfile(profile);
    await store.upsertPlant(basePlant({ speciesKey: profile.speciesKey, speciesProfile: profile }));

    const refreshedProfile = createProfile({
      moisturePolicy: {
        waterIntervalDays: 5,
        soilMoistureThreshold: 28,
        humidityPreference: "high",
        lightRequirement: "medium",
        notes: ["Avoid cold drafts"],
      },
      source: "chatgpt",
      updatedAt: "2024-02-01T00:00:00.000Z",
    });

    const resolvePolicy = vi.fn(async () => {
      await store.upsertSpeciesProfile(refreshedProfile);
      return refreshedProfile;
    });

    const { result } = renderHook(() =>
      usePlantActions({
        store,
        resolvePolicy,
        speciesProfiles: { [profile.speciesKey]: profile },
      }),
    );

    await act(async () => {
      await result.current.editPlantDetails("plant-1", {
        environment: "indoor",
        notes: "Prefers bright light",
        forcePolicyRefresh: true,
      });
    });

    expect(resolvePolicy).toHaveBeenCalledOnce();
    const updated = store.getPlant("plant-1");
    expect(updated?.environment).toBe("indoor");
    expect(updated?.notes).toBe("Prefers bright light");
    expect(updated?.speciesProfile?.source).toBe("chatgpt");
  });
});
