import type { SpeciesType } from "@core/models/speciesProfile";
import type { IdentificationCandidate } from "@services/id/types";
import type { PolicyGenerationRequest } from "@services/policy/chatgpt";
import type { PreparedImageFile } from "@app/utils/imageProcessing";

export const SPECIES_TYPE_OPTIONS: SpeciesType[] = [
  "succulent",
  "semi-succulent",
  "tropical",
  "fern",
  "other",
];

export const ensureType = (candidate: IdentificationCandidate): SpeciesType => {
  const candidateType = candidate.type?.toLowerCase();
  if (candidateType && SPECIES_TYPE_OPTIONS.includes(candidateType as SpeciesType)) {
    return candidateType as SpeciesType;
  }
  return "other";
};

export const buildPolicyRequest = (candidate: IdentificationCandidate): PolicyGenerationRequest => ({
  speciesKey: candidate.speciesKey,
  canonicalName: candidate.canonicalName,
  commonName: candidate.commonName,
  confidence: candidate.score,
  type: ensureType(candidate),
});

export const formatPercentage = (value: number | undefined): string => {
  if (typeof value !== "number" || Number.isNaN(value)) return "N/A";
  return `${(value * 100).toFixed(1)}%`;
};

export type ImageStatusInput = Pick<PreparedImageFile, "width" | "height" | "originalWidth" | "originalHeight" | "wasDownscaled">;

export const getImageProcessingStatus = (): string => "Processing image...";

export const getImageReadyStatus = (details: ImageStatusInput): string =>
  details.wasDownscaled
    ? `Image optimized to ${details.width}x${details.height}px (down from ${details.originalWidth}x${details.originalHeight}px).`
    : `Image ready (${details.width}x${details.height}px).`;

export const getCacheHitStatus = (): string => "Loaded cached care guide.";

export const getPolicyGenerationStatus = (forceRefresh?: boolean): string =>
  forceRefresh ? "Refreshing care guide..." : "Generating care guide...";

export const getPolicyReadyStatus = (): string => "All set! Review the care guide below.";

export const getIdentifyingStatus = (): string => "Identifying species...";
