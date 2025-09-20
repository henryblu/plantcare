import { SpeciesType } from '../../core/models/speciesProfile';

export type IdentificationSource = 'plantnet' | 'mock' | 'manual';

export interface PlantImageInput {
  /** Raw binary payload for the image (ArrayBuffer, Uint8Array, Blob, etc.). */
  data?: ArrayBuffer | Uint8Array | Blob;
  /** Local or remote URI when binary data is not yet loaded. */
  uri?: string;
  /** Optional filename hint for multipart uploads. */
  filename?: string;
  /** MIME type hint for the payload (defaults to image/jpeg). */
  contentType?: string;
}

export interface IdentifyRequest {
  images: PlantImageInput[];
  organs?: string[];
  language?: string;
  /** Max number of candidates to return after normalization. */
  limit?: number;
}

export interface IdentificationCandidate {
  speciesKey: string;
  canonicalName: string;
  commonName?: string;
  taxonId?: string;
  score: number;
  type?: SpeciesType;
  source: IdentificationSource;
}

export interface ManualEntryInput {
  canonicalName: string;
  commonName?: string;
  type?: SpeciesType;
}

export const normalizeSpeciesKey = (canonicalName: string, taxonId?: string | number | null): string => {
  if (taxonId !== undefined && taxonId !== null) {
    const normalized = String(taxonId).trim();
    if (normalized.length > 0) return normalized;
  }
  return canonicalName.trim().toLowerCase();
};