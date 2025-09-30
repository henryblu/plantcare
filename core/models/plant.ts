import { MoisturePolicy, clampMoisturePolicy, isMoisturePolicy } from './moisturePolicy';
import { SpeciesProfile, isSpeciesProfile } from './speciesProfile';

export type PlantEnvironment = 'indoor' | 'outdoor' | 'unspecified';

export const PLANT_ENVIRONMENTS: PlantEnvironment[] = ['indoor', 'outdoor', 'unspecified'];

export interface Plant {
  id: string;
  speciesKey: string;
  nickname?: string;
  location?: string;
  photoUri?: string;
  /** Where the plant primarily lives (used for tailoring guidance). */
  environment?: PlantEnvironment;
  /** ISO timestamp when the plant record was created. */
  createdAt: string;
  /** ISO timestamp when the plant record was last updated. */
  updatedAt: string;
  /** ISO timestamp of the last watering event, if tracked. */
  lastWateredAt?: string;
  /** Optional short journal entry (≤160 chars) about the plant. */
  notes?: string;
  /** Optional override to diverge from the cached species policy. */
  moisturePolicyOverride?: MoisturePolicy;
  /** Resolved species profile at the time of hydration (not persisted). */
  speciesProfile?: SpeciesProfile;
}

const MAX_NOTE_LENGTH = 160;

const isIsoDate = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const time = Date.parse(value);
  return Number.isFinite(time);
};

export function isPlant(value: unknown): value is Plant {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;

  if (typeof candidate.id !== 'string' || candidate.id.trim().length === 0) return false;
  if (typeof candidate.speciesKey !== 'string' || candidate.speciesKey.trim().length === 0) return false;

  if (candidate.nickname !== undefined && typeof candidate.nickname !== 'string') return false;
  if (candidate.location !== undefined && typeof candidate.location !== 'string') return false;
  if (candidate.photoUri !== undefined && typeof candidate.photoUri !== 'string') return false;

  if (candidate.environment !== undefined) {
    if (typeof candidate.environment !== 'string') return false;
    if (!PLANT_ENVIRONMENTS.includes(candidate.environment as PlantEnvironment)) return false;
  }

  if (!isIsoDate(candidate.createdAt)) return false;
  if (!isIsoDate(candidate.updatedAt)) return false;
  if (candidate.lastWateredAt !== undefined && !isIsoDate(candidate.lastWateredAt)) return false;

  if (candidate.notes !== undefined) {
    if (typeof candidate.notes !== 'string') return false;
    if (candidate.notes.length > MAX_NOTE_LENGTH) return false;
  }

  if (candidate.moisturePolicyOverride !== undefined && !isMoisturePolicy(candidate.moisturePolicyOverride)) return false;
  if (candidate.speciesProfile !== undefined && !isSpeciesProfile(candidate.speciesProfile)) return false;

  return true;
}

export function normalizePlant(plant: Plant): Plant {
  const base = {
    ...plant,
    id: plant.id.trim(),
    speciesKey: plant.speciesKey.trim().toLowerCase(),
    nickname: plant.nickname?.trim() || undefined,
    location: plant.location?.trim() || undefined,
    photoUri: plant.photoUri?.trim() || undefined,
    environment:
      typeof plant.environment === 'string'
        ? (PLANT_ENVIRONMENTS.includes(plant.environment.trim().toLowerCase() as PlantEnvironment)
            ? (plant.environment.trim().toLowerCase() as PlantEnvironment)
            : undefined)
        : undefined,
    notes: plant.notes?.trim() || undefined,
    createdAt: new Date(plant.createdAt).toISOString(),
    updatedAt: new Date(plant.updatedAt).toISOString(),
    lastWateredAt: plant.lastWateredAt ? new Date(plant.lastWateredAt).toISOString() : undefined,
  };

  return {
    ...base,
    moisturePolicyOverride: plant.moisturePolicyOverride
      ? clampMoisturePolicy(plant.moisturePolicyOverride)
      : undefined,
  };
}