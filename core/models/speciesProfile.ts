import { MoisturePolicy, clampMoisturePolicy, isMoisturePolicy } from './moisturePolicy';

export type SpeciesType = 'succulent' | 'semi-succulent' | 'tropical' | 'fern' | 'other';
export type PolicySource = 'chatgpt' | 'seed' | 'cache' | 'manual';

export interface SpeciesProfile {
  /** Stable cache key, typically a PlantNet taxonId or canonical name slug. */
  speciesKey: string;
  canonicalName: string;
  commonName?: string;
  type: SpeciesType;
  /** Confidence score from identification provider (0-1). */
  confidence?: number;
  moisturePolicy: MoisturePolicy;
  source: PolicySource;
  /** ISO timestamp when policy was generated or refreshed. */
  updatedAt: string;
  /** Optional ISO timestamp when record created; defaults to updatedAt. */
  createdAt?: string;
}

const SPECIES_TYPES: SpeciesType[] = ['succulent', 'semi-succulent', 'tropical', 'fern', 'other'];
const POLICY_SOURCES: PolicySource[] = ['chatgpt', 'seed', 'cache', 'manual'];

const isIsoDate = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const time = Date.parse(value);
  return Number.isFinite(time);
};

export function isSpeciesProfile(value: unknown): value is SpeciesProfile {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;

  if (typeof candidate.speciesKey !== 'string' || candidate.speciesKey.trim().length === 0) return false;
  if (typeof candidate.canonicalName !== 'string' || candidate.canonicalName.trim().length === 0) return false;

  if (candidate.commonName !== undefined && typeof candidate.commonName !== 'string') return false;

  if (typeof candidate.type !== 'string' || !SPECIES_TYPES.includes(candidate.type as SpeciesType)) return false;

  if (candidate.confidence !== undefined) {
    if (typeof candidate.confidence !== 'number') return false;
    if (candidate.confidence < 0 || candidate.confidence > 1) return false;
  }

  if (!isMoisturePolicy(candidate.moisturePolicy)) return false;

  if (typeof candidate.source !== 'string' || !POLICY_SOURCES.includes(candidate.source as PolicySource)) return false;

  if (!isIsoDate(candidate.updatedAt)) return false;
  if (candidate.createdAt !== undefined && !isIsoDate(candidate.createdAt)) return false;

  return true;
}

export function normalizeSpeciesProfile(profile: SpeciesProfile): SpeciesProfile {
  const trimmedCommon = profile.commonName?.trim();
  return {
    ...profile,
    speciesKey: profile.speciesKey.trim().toLowerCase(),
    canonicalName: profile.canonicalName.trim(),
    commonName: trimmedCommon ? trimmedCommon : undefined,
    moisturePolicy: clampMoisturePolicy(profile.moisturePolicy),
    updatedAt: new Date(profile.updatedAt).toISOString(),
    createdAt: profile.createdAt ? new Date(profile.createdAt).toISOString() : undefined,
  };
}