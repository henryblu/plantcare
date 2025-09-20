export type HumidityPreference = 'low' | 'medium' | 'high';
export type LightRequirement = 'low' | 'medium' | 'bright-indirect' | 'full-sun';

export interface MoisturePolicy {
  /** Recommended days between thorough waterings (clamped 0-60). */
  waterIntervalDays: number;
  /** Soil moisture percentage threshold before watering (0-60%). */
  soilMoistureThreshold: number;
  /** Preferred humidity band for the species. */
  humidityPreference: HumidityPreference;
  /** Dominant light requirement. */
  lightRequirement: LightRequirement;
  /** Up to two short operational notes for care guidance. */
  notes: string[];
}

const HUMIDITY_OPTIONS: HumidityPreference[] = ['low', 'medium', 'high'];
const LIGHT_OPTIONS: LightRequirement[] = ['low', 'medium', 'bright-indirect', 'full-sun'];

const MAX_NOTES = 2;
const MAX_THRESHOLD = 60;

export function isMoisturePolicy(value: unknown): value is MoisturePolicy {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;

  const waterInterval = candidate.waterIntervalDays;
  if (typeof waterInterval !== 'number' || !Number.isInteger(waterInterval)) return false;
  if (waterInterval < 0 || waterInterval > MAX_THRESHOLD) return false;

  const soilThreshold = candidate.soilMoistureThreshold;
  if (typeof soilThreshold !== 'number') return false;
  if (soilThreshold < 0 || soilThreshold > MAX_THRESHOLD) return false;

  const humidity = candidate.humidityPreference;
  if (typeof humidity !== 'string') return false;
  if (!HUMIDITY_OPTIONS.includes(humidity as HumidityPreference)) return false;

  const light = candidate.lightRequirement;
  if (typeof light !== 'string') return false;
  if (!LIGHT_OPTIONS.includes(light as LightRequirement)) return false;

  const notes = candidate.notes;
  if (!Array.isArray(notes)) return false;
  if (notes.length > MAX_NOTES) return false;
  if (!notes.every((note) => typeof note === 'string' && note.trim().length > 0 && note.length <= 160)) {
    return false;
  }

  return true;
}

export function clampMoisturePolicy(policy: MoisturePolicy): MoisturePolicy {
  return {
    ...policy,
    waterIntervalDays: Math.max(0, Math.min(MAX_THRESHOLD, Math.round(policy.waterIntervalDays))),
    soilMoistureThreshold: Math.max(0, Math.min(MAX_THRESHOLD, Math.round(policy.soilMoistureThreshold))),
    notes: policy.notes
      .slice(0, MAX_NOTES)
      .map((note) => note.trim().slice(0, 160))
      .filter((note) => note.length > 0),
  };
}
