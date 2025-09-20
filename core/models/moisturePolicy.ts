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

  if (!Number.isInteger(candidate.waterIntervalDays)) return false;
  if (candidate.waterIntervalDays < 0 || candidate.waterIntervalDays > MAX_THRESHOLD) return false;

  if (typeof candidate.soilMoistureThreshold !== 'number') return false;
  if (candidate.soilMoistureThreshold < 0 || candidate.soilMoistureThreshold > MAX_THRESHOLD) return false;

  if (typeof candidate.humidityPreference !== 'string') return false;
  if (!HUMIDITY_OPTIONS.includes(candidate.humidityPreference as HumidityPreference)) return false;

  if (typeof candidate.lightRequirement !== 'string') return false;
  if (!LIGHT_OPTIONS.includes(candidate.lightRequirement as LightRequirement)) return false;

  if (!Array.isArray(candidate.notes)) return false;
  if (candidate.notes.length > MAX_NOTES) return false;
  if (!candidate.notes.every((note) => typeof note === 'string' && note.trim().length > 0 && note.length <= 160)) {
    return false;
  }

  return true;
}

export function clampMoisturePolicy(policy: MoisturePolicy): MoisturePolicy {
  return {
    ...policy,
    waterIntervalDays: Math.max(0, Math.min(MAX_THRESHOLD, Math.round(policy.waterIntervalDays))),
    soilMoistureThreshold: Math.max(0, Math.min(MAX_THRESHOLD, Math.round(policy.soilMoistureThreshold))),
    notes: policy.notes.slice(0, MAX_NOTES).map((note) => note.trim()).filter(Boolean),
  };
}