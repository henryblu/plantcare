/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import HomeScreen from "./HomeScreen";
import type { Plant } from "@core/models/plant";
import type { SpeciesProfile } from "@core/models/speciesProfile";
import type { MoisturePolicy } from "@core/models/moisturePolicy";

const basePolicy: MoisturePolicy = {
  waterIntervalDays: 2,
  soilMoistureThreshold: 10,
  humidityPreference: "medium",
  lightRequirement: "bright-indirect",
  notes: [],
};

const buildPlant = (overrides: Partial<Plant>): Plant => ({
  id: "plant-" + overrides.id,
  speciesKey: "species-" + (overrides.id ?? "1"),
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  ...overrides,
});

const buildProfile = (speciesKey: string, names: { canonical: string; common?: string }): SpeciesProfile => ({
  speciesKey,
  canonicalName: names.canonical,
  commonName: names.common,
  type: "tropical",
  moisturePolicy: basePolicy,
  source: "seed",
  updatedAt: "2024-01-01T00:00:00.000Z",
});

describe("HomeScreen", () => {
  it("sorts plants by createdAt descending", () => {
    const plants: Plant[] = [
      buildPlant({ id: "a", nickname: "Alpha", createdAt: "2024-03-01T10:00:00.000Z" }),
      buildPlant({ id: "b", nickname: "Bravo", createdAt: "2024-05-01T10:00:00.000Z" }),
      buildPlant({ id: "c", nickname: "Charlie", createdAt: "2024-04-01T10:00:00.000Z" }),
    ];

    const speciesCache: Record<string, SpeciesProfile> = Object.fromEntries(
      plants.map((plant) => [
        plant.speciesKey,
        buildProfile(plant.speciesKey, { canonical: plant.nickname ?? plant.speciesKey }),
      ]),
    );

    render(
      <HomeScreen
        plants={plants}
        speciesCache={speciesCache}
        onAddPlant={() => {}}
        status="ready"
        onRenamePlant={() => {}}
        onDeletePlant={() => {}}
        onEditPlant={() => {}}
      />,
    );

    const headings = screen.getAllByRole("heading", { level: 4 });
    const order = headings.map((heading) => heading.textContent);

    expect(order).toEqual(["Bravo", "Charlie", "Alpha"]);
  });
});
