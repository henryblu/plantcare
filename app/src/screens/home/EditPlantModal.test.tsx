/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Plant } from "@core/models/plant";
import EditPlantModal from "./EditPlantModal";

const basePlant: Plant = {
  id: "plant-1",
  speciesKey: "ficus-lyrata",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

describe("EditPlantModal", () => {
  afterEach(() => {
    cleanup();
  });

  it("validates note length before submitting", async () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <EditPlantModal plant={basePlant} onClose={() => {}} onSubmit={handleSubmit} errorMessage={null} />, 
      { legacyRoot: true },
    );

    const notesField = screen.getByLabelText(/custom notes/i);
    fireEvent.change(notesField, { target: { value: "a".repeat(170) } });

    const form = notesField.closest("form");
    expect(form).not.toBeNull();
    if (!form) return;
    fireEvent.submit(form);

    await screen.findByText(/must be 160 characters or fewer/i);
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it("submits trimmed notes and environment", async () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <EditPlantModal plant={basePlant} onClose={() => {}} onSubmit={handleSubmit} errorMessage={null} />, 
      { legacyRoot: true },
    );

    fireEvent.change(screen.getByLabelText(/plant type/i), { target: { value: "outdoor" } });
    const notesField = screen.getByLabelText(/custom notes/i);
    fireEvent.change(notesField, { target: { value: "  Keep evenly moist  " } });

    const form = notesField.closest("form");
    expect(form).not.toBeNull();
    if (!form) return;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith({
        environment: "outdoor",
        notes: "Keep evenly moist",
        forcePolicyRefresh: false,
      });
    });
  });
});
