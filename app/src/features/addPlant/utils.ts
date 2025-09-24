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

const clampScore = (score: number): number => {
  if (!Number.isFinite(score)) return 0;
  if (score < 0) return 0;
  if (score > 1) return 1;
  return score;
};

export type ConfidenceLevel = "high" | "medium" | "low";

export interface ConfidenceAssessment {
  topScore: number;
  secondScore: number;
  difference: number;
  level: ConfidenceLevel;
}

const HIGH_SCORE_THRESHOLD = 0.60;
const HIGH_DIFF_THRESHOLD = 0.45;
const OK_SCORE_THRESHOLD = 0.50;
const OK_DIFF_THRESHOLD = 0.30;

export const assessConfidence = (candidates: IdentificationCandidate[]): ConfidenceAssessment => {
  const scores = candidates
    .map((candidate) => clampScore(typeof candidate.score === "number" ? candidate.score : 0))
    .sort((a, b) => b - a);

  const topScore = scores[0] ?? 0;
  const secondScore = scores[1] ?? 0;
  const difference = topScore - secondScore > 0 ? topScore - secondScore : 0;

  let level: ConfidenceLevel = "low";
  if (topScore >= HIGH_SCORE_THRESHOLD || difference >= HIGH_DIFF_THRESHOLD) {
    level = "high";
  } else if (topScore >= OK_SCORE_THRESHOLD || difference >= OK_DIFF_THRESHOLD) {
    level = "medium";
  }

  return {
    topScore,
    secondScore,
    difference,
    level,
  };
};

export const ADDITIONAL_PHOTO_GUIDANCE = [
  "Add a bright leaf close-up to help the ID.",
  "Capture the entire plant with pot and surroundings.",
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

export const getReidentifyStatus = (photoCount: number): string => {
  if (photoCount <= 1) {
    return "Re-running identification...";
  }
  return `Re-running identification with ${photoCount} photos...`;
};

export const getLowConfidenceStatus = (
  assessment: ConfidenceAssessment,
  options: { reachedLimit?: boolean } = {},
): string => {
  const best = formatPercentage(assessment.topScore);
  const gap = formatPercentage(assessment.difference);
  if (options.reachedLimit) {
    return `Confidence stayed low (best match ${best}, gap ${gap}). Enter the species manually or try different photos.`;
  }
  return `Low confidence: best match ${best} with ${gap} gap. Add clearer photos for a better match.`;
};

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
