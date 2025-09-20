import type { SpeciesType } from '../models/speciesProfile';
import type {
  HumidityPreference,
  LightRequirement,
  MoisturePolicy,
} from '../models/moisturePolicy';
import { clampMoisturePolicy } from '../models/moisturePolicy';

export const SUPPORTED_SPECIES_TYPES: readonly SpeciesType[] = [
  'succulent',
  'semi-succulent',
  'tropical',
  'fern',
  'other',
] as const;

const HUMIDITY_VALUES: readonly HumidityPreference[] = ['low', 'medium', 'high'] as const;
const LIGHT_VALUES: readonly LightRequirement[] = ['low', 'medium', 'bright-indirect', 'full-sun'] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeSpeciesType = (value: unknown, fallback: SpeciesType): SpeciesType => {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  const match = SUPPORTED_SPECIES_TYPES.find((type) => type === normalized);
  return match ?? fallback;
};

const coerceInteger = (value: unknown, label: string): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value);
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.trim());
    if (Number.isFinite(parsed)) {
      return Math.round(parsed);
    }
  }
  throw new PolicySchemaError(`${label} must be a finite number.`);
};

const coerceEnum = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string,
): T => {
  if (typeof value !== 'string') {
    throw new PolicySchemaError(`${label} must be a string.`);
  }
  const normalized = value.trim().toLowerCase();
  const match = allowed.find((option) => option === normalized);
  if (!match) {
    throw new PolicySchemaError(
      `${label} must be one of: ${allowed
        .map((option) => `"${option}"`)
        .join(', ')}.`,
    );
  }
  return match;
};

const coerceNotes = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    throw new PolicySchemaError('moisturePolicy.notes must be an array.');
  }
  return value
    .map((note) => (typeof note === 'string' ? note.trim() : ''))
    .filter((note) => note.length > 0)
    .map((note) => note.slice(0, 160));
};

const parseMoisturePolicy = (value: unknown): MoisturePolicy => {
  if (!isRecord(value)) {
    throw new PolicySchemaError('moisturePolicy must be an object.');
  }

  const waterIntervalDays = coerceInteger(value.waterIntervalDays, 'moisturePolicy.waterIntervalDays');
  const soilMoistureThreshold = coerceInteger(
    value.soilMoistureThreshold,
    'moisturePolicy.soilMoistureThreshold',
  );
  const humidityPreference = coerceEnum<HumidityPreference>(
    value.humidityPreference,
    HUMIDITY_VALUES,
    'moisturePolicy.humidityPreference',
  );
  const lightRequirement = coerceEnum<LightRequirement>(
    value.lightRequirement,
    LIGHT_VALUES,
    'moisturePolicy.lightRequirement',
  );

  if (!('notes' in value)) {
    throw new PolicySchemaError('moisturePolicy.notes is required.');
  }
  const notes = coerceNotes(value.notes);

  return {
    waterIntervalDays,
    soilMoistureThreshold,
    humidityPreference,
    lightRequirement,
    notes,
  };
};

export interface NormalizePolicyOptions {
  fallbackType?: SpeciesType;
}

export interface NormalizedPolicyResult {
  type: SpeciesType;
  moisturePolicy: MoisturePolicy;
}

export class PolicySchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PolicySchemaError';
  }
}

export const normalizePolicyPayload = (
  payload: unknown,
  options: NormalizePolicyOptions = {},
): NormalizedPolicyResult => {
  const fallbackType = options.fallbackType ?? 'other';
  if (!SUPPORTED_SPECIES_TYPES.includes(fallbackType)) {
    throw new PolicySchemaError(`Unsupported fallback species type: ${fallbackType}`);
  }

  if (!isRecord(payload)) {
    throw new PolicySchemaError('Policy payload must be an object.');
  }

  const normalizedType = normalizeSpeciesType(payload.type, fallbackType);
  const normalizedPolicy = clampMoisturePolicy(parseMoisturePolicy(payload.moisturePolicy));

  return {
    type: normalizedType,
    moisturePolicy: normalizedPolicy,
  };
};
