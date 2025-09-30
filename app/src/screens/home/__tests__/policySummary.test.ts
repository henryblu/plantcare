import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Plant } from "@core/models/plant";
import type { SpeciesProfile } from "@core/models/speciesProfile";
import { buildPlantPolicySummary, formatLastUpdated, selectPlantPolicy } from "../policySummary";

const createPlant = (overrides: Partial<Plant> = {}): Plant => ({
  id: "plant-1",
  speciesKey: "epipremnum-aureum",
  createdAt: "2024-01-01T10:00:00.000Z",
  updatedAt: "2024-01-03T10:00:00.000Z",
  ...overrides,
});

const basePolicy = {
  waterIntervalDays: 2,
  soilMoistureThreshold: 12,
  humidityPreference: "medium" as const,
  lightRequirement: "bright-indirect" as const,
  notes: ["Let the topsoil dry between waterings."],
};

const createProfile = (overrides: Partial<SpeciesProfile> = {}): SpeciesProfile => ({
  speciesKey: "epipremnum-aureum",
  canonicalName: "Epipremnum aureum",
  commonName: "Golden pothos",
  type: "tropical",
  moisturePolicy: { ...basePolicy },
  source: "chatgpt",
  updatedAt: "2024-01-02T10:00:00.000Z",
  ...overrides,
});

describe("policySummary", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-02-01T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds a concise summary from the moisture policy", () => {
    const plant = createPlant();
    const profile = createProfile();

    const summary = buildPlantPolicySummary(plant, profile);

    expect(summary).toBe("Mostly dry 2–3 days; water <12%");
  });

  it("prefers the plant override policy when present", () => {
    const plant = createPlant({
      moisturePolicyOverride: {
        waterIntervalDays: 5,
        soilMoistureThreshold: 4,
        humidityPreference: "low",
        lightRequirement: "full-sun",
        notes: [],
      },
    });
    const profile = createProfile();

    const summary = buildPlantPolicySummary(plant, profile);
    const selectedPolicy = selectPlantPolicy(plant, profile);

    expect(summary).toBe("Very dry ~5 days; water <4%");
    expect(selectedPolicy).toBe(plant.moisturePolicyOverride);
  });

  it("returns null when no policy is available", () => {
    const plant = createPlant();

    expect(buildPlantPolicySummary(plant, undefined)).toBeNull();
  });

  it("formats recent timestamps as relative time", () => {
    const formatted = formatLastUpdated("2024-02-01T10:00:00.000Z");
    expect(formatted).toBe("2 hours ago");
  });

  it("falls back to calendar dates for older entries", () => {
    const formatted = formatLastUpdated("2023-05-18T08:00:00.000Z");
    const expected = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date("2023-05-18T08:00:00.000Z"));
    expect(formatted).toBe(expected);
  });
});
