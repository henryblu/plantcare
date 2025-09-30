import { useCallback, useEffect, useRef, useState } from "react";
import type { Plant, PlantEnvironment } from "@core/models/plant";
import type { SpeciesProfile } from "@core/models/speciesProfile";
import type { PlantStore } from "@core/state/store";
import type { PolicyGenerationRequest } from "@services/policy/chatgpt";
import type { ResolvePolicyOptions } from "@core/orchestration/cacheFlow";

export type ResolvePolicyFn = (
  request: PolicyGenerationRequest,
  options?: ResolvePolicyOptions,
) => Promise<SpeciesProfile>;

export interface EditPlantDetailsInput {
  environment: PlantEnvironment | "unspecified";
  notes: string;
  forcePolicyRefresh: boolean;
}

interface UsePlantActionsOptions {
  store: PlantStore;
  resolvePolicy?: ResolvePolicyFn | null;
  speciesProfiles: Record<string, SpeciesProfile>;
  undoTimeoutMs?: number;
}

interface UndoState {
  plant: Plant;
}

const MAX_NOTE_LENGTH = 160;

const coerceNotes = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed.slice(0, MAX_NOTE_LENGTH);
};

const resolveSpeciesProfile = (
  plant: Plant,
  store: PlantStore,
  cache: Record<string, SpeciesProfile>,
): SpeciesProfile | undefined => {
  if (plant.speciesProfile) {
    return plant.speciesProfile;
  }
  if (cache[plant.speciesKey]) {
    return cache[plant.speciesKey];
  }
  return store.getSpeciesProfile(plant.speciesKey);
};

export interface PlantActionsState {
  renamePlant: (id: string, nickname: string | null) => Promise<void>;
  deletePlant: (id: string) => Promise<void>;
  undoDelete: () => Promise<void>;
  editPlantDetails: (id: string, input: EditPlantDetailsInput) => Promise<void>;
  undoState: UndoState | null;
  errorMessage: string | null;
  clearError: () => void;
}

export const usePlantActions = ({
  store,
  resolvePolicy,
  speciesProfiles,
  undoTimeoutMs = 6000,
}: UsePlantActionsOptions): PlantActionsState => {
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearUndo = useCallback(() => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    setUndoState(null);
  }, []);

  useEffect(() => clearUndo, [clearUndo]);

  const renamePlant = useCallback(
    async (id: string, nickname: string | null) => {
      const existing = store.getPlant(id);
      if (!existing) {
        const error = new Error("Plant not found");
        setErrorMessage("We couldn't find that plant. Try refreshing.");
        throw error;
      }

      const trimmed = nickname?.trim();
      const next: Plant = {
        ...existing,
        nickname: trimmed && trimmed.length > 0 ? trimmed : undefined,
        updatedAt: new Date().toISOString(),
      };

      try {
        await store.upsertPlant(next);
        setErrorMessage(null);
      } catch (error) {
        console.error("[usePlantActions] Failed to rename plant", error);
        setErrorMessage("Unable to rename plant right now. Please try again.");
        throw error;
      }
    },
    [store],
  );

  const deletePlant = useCallback(
    async (id: string) => {
      const existing = store.getPlant(id);
      if (!existing) {
        const error = new Error("Plant not found");
        setErrorMessage("That plant was already removed.");
        throw error;
      }

      try {
        await store.removePlant(id);
        setErrorMessage(null);
        if (undoTimerRef.current) {
          clearTimeout(undoTimerRef.current);
        }
        setUndoState({ plant: existing });
        undoTimerRef.current = setTimeout(() => {
          setUndoState(null);
          undoTimerRef.current = null;
        }, undoTimeoutMs);
      } catch (error) {
        console.error("[usePlantActions] Failed to delete plant", error);
        setErrorMessage("Failed to delete plant. Please try again.");
        throw error;
      }
    },
    [store, undoTimeoutMs],
  );

  const undoDelete = useCallback(async () => {
    if (!undoState) return;
    const { plant } = undoState;
    clearUndo();

    try {
      await store.upsertPlant(plant);
      setErrorMessage(null);
    } catch (error) {
      console.error("[usePlantActions] Failed to undo delete", error);
      setErrorMessage("We couldn't restore that plant. Try adding it again.");
      throw error;
    }
  }, [clearUndo, store, undoState]);

  const editPlantDetails = useCallback(
    async (id: string, input: EditPlantDetailsInput) => {
      const existing = store.getPlant(id);
      if (!existing) {
        const error = new Error("Plant not found");
        setErrorMessage("We couldn't find that plant. Try refreshing.");
        throw error;
      }

      let profile = resolveSpeciesProfile(existing, store, speciesProfiles);

      if (input.forcePolicyRefresh) {
        if (!resolvePolicy) {
          const error = new Error("Policy service unavailable");
          setErrorMessage("Policy service is not configured. Add keys in Settings.");
          throw error;
        }

        const request: PolicyGenerationRequest = {
          speciesKey: existing.speciesKey,
          canonicalName: profile?.canonicalName ?? existing.speciesKey,
          commonName: profile?.commonName,
          type: profile?.type,
          confidence: profile?.confidence,
        };

        try {
          profile = await resolvePolicy(request, { forceRefresh: true });
        } catch (error) {
          console.error("[usePlantActions] Failed to refresh policy", error);
          setErrorMessage("Unable to refresh the care policy. Please try again later.");
          throw error;
        }
      }

      const next: Plant = {
        ...existing,
        environment: input.environment === "unspecified" ? undefined : input.environment,
        notes: coerceNotes(input.notes),
        updatedAt: new Date().toISOString(),
        speciesProfile: profile ?? existing.speciesProfile,
      };

      try {
        await store.upsertPlant(next);
        setErrorMessage(null);
      } catch (error) {
        console.error("[usePlantActions] Failed to update plant details", error);
        setErrorMessage("We couldn't save those details. Please try again.");
        throw error;
      }
    },
    [resolvePolicy, speciesProfiles, store],
  );

  const clearError = useCallback(() => setErrorMessage(null), []);

  return {
    renamePlant,
    deletePlant,
    undoDelete,
    editPlantDetails,
    undoState,
    errorMessage,
    clearError,
  };
};

export default usePlantActions;
