/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import PlantCard from "./PlantCard";
import type { Plant } from "@core/models/plant";
import type { SpeciesProfile } from "@core/models/speciesProfile";
import type { MoisturePolicy } from "@core/models/moisturePolicy";

const mockPolicy: MoisturePolicy = {
  waterIntervalDays: 3,
  soilMoistureThreshold: 12,
  humidityPreference: "medium",
  lightRequirement: "bright-indirect",
  notes: ["Mist weekly"],
};

const basePlant: Plant = {
  id: "plant-1",
  speciesKey: "ficus-lyrata",
  nickname: "Figgy",
  photoUri: "https://example.com/plant.jpg",
  createdAt: "2024-05-01T12:00:00.000Z",
  updatedAt: "2024-05-02T12:00:00.000Z",
};

const baseProfile: SpeciesProfile = {
  speciesKey: "ficus-lyrata",
  canonicalName: "Ficus lyrata",
  commonName: "Fiddle Leaf Fig",
  type: "tropical",
  moisturePolicy: mockPolicy,
  source: "seed",
  updatedAt: "2024-04-01T12:00:00.000Z",
};

afterEach(() => {
  cleanup();
});

describe("PlantCard", () => {
  it("calls onRename with trimmed nickname", async () => {
    const handleRename = vi.fn().mockResolvedValue(undefined);

    render(<PlantCard plant={basePlant} profile={baseProfile} onRename={handleRename} />, { legacyRoot: true });

    const [card] = screen.getAllByRole("listitem", { name: basePlant.nickname ?? "" });
    const utils = within(card);
    const menuButton = utils.getByRole("button", { name: /plant actions/i });
    fireEvent.click(menuButton);
    fireEvent.click(await utils.findByRole("menuitem", { name: /rename/i }));

    const input = await utils.findByLabelText(/nickname/i);
    fireEvent.change(input, { target: { value: "  New Fig  " } });

    const form = input.closest("form");
    expect(form).not.toBeNull();
    if (!form) return;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(handleRename).toHaveBeenCalledWith(basePlant.id, "New Fig");
    });
  });

  it("confirms deletion before calling onDelete", async () => {
    const handleDelete = vi.fn().mockResolvedValue(undefined);

    render(<PlantCard plant={basePlant} profile={baseProfile} onDelete={handleDelete} />, { legacyRoot: true });

    const [card] = screen.getAllByRole("listitem", { name: basePlant.nickname ?? "" });
    const utils = within(card);
    const menuButton = utils.getByRole("button", { name: /plant actions/i });
    fireEvent.click(menuButton);
    const deleteMenuItem = await utils.findByRole("menuitem", { name: /delete/i });
    fireEvent.click(deleteMenuItem);

    const dialog = await screen.findByRole("alertdialog");
    const deleteButton = within(dialog).getByRole("button", { name: /delete plant/i });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(handleDelete).toHaveBeenCalledWith(basePlant.id);
    });
  });
});
