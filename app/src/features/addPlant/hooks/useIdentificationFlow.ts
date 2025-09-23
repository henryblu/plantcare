import { useCallback, useState } from "react";

import {
  assessConfidence,
  getIdentifyingStatus,
  getLowConfidenceStatus,
  getReidentifyStatus,
} from "@app/features/addPlant/utils";
import { PlantNetError } from "@services/id/plantNet";
import type { IdentificationCandidate, IdentifyRequest } from "@services/id/types";
import type { ResolvePolicyOptions } from "@core/orchestration/cacheFlow";

import type { UiError, UiStatus } from "./types";
import type { PreparedImageFile } from "@app/utils/imageProcessing";

export interface IdentifyWithImagesOptions {
  fromRetry?: boolean;
}

export interface UseIdentificationFlowOptions {
  identify: (request: IdentifyRequest) => Promise<IdentificationCandidate[]>;
  plantNetConfigured: boolean;
  maxPhotos: number;
  getPreparedImages: () => PreparedImageFile[];
  onReset: () => void;
  onStatus: (status: UiStatus | null) => void;
  onError: (error: UiError | null) => void;
  onManualModeChange: (enabled: boolean) => void;
  runPolicyForCandidate: (
    candidate: IdentificationCandidate | null,
    options?: ResolvePolicyOptions,
  ) => Promise<void>;
  setSelectedKey: (key: string | null) => void;
  startRun: () => number;
  finishRun: (token: number) => void;
  isRunStale: (token: number) => boolean;
}

export interface UseIdentificationFlowResult {
  candidates: IdentificationCandidate[];
  confidence: ReturnType<typeof assessConfidence> | null;
  manualRecommended: boolean;
  identifyWithImages: (
    images: PreparedImageFile[],
    options?: IdentifyWithImagesOptions,
  ) => Promise<void>;
  handleSelectCandidate: (speciesKey: string) => Promise<void>;
  applyManualCandidate: (candidate: IdentificationCandidate) => Promise<void>;
  reset: () => void;
  clearAssessments: () => void;
}

export const useIdentificationFlow = ({
  identify,
  plantNetConfigured,
  maxPhotos,
  getPreparedImages,
  onReset,
  onStatus,
  onError,
  onManualModeChange,
  runPolicyForCandidate,
  setSelectedKey,
  startRun,
  finishRun,
  isRunStale,
}: UseIdentificationFlowOptions): UseIdentificationFlowResult => {
  const [candidates, setCandidates] = useState<IdentificationCandidate[]>([]);
  const [confidence, setConfidence] = useState<ReturnType<typeof assessConfidence> | null>(null);
  const [manualRecommended, setManualRecommended] = useState(false);

  const reset = useCallback(() => {
    setCandidates([]);
    setConfidence(null);
    setManualRecommended(false);
    setSelectedKey(null);
  }, [setSelectedKey]);

  const clearAssessments = useCallback(() => {
    setConfidence(null);
    setManualRecommended(false);
  }, []);

  const identifyWithImages = useCallback(
    async (images: PreparedImageFile[], options: IdentifyWithImagesOptions = {}) => {
      if (!images.length) {
        onError({
          type: "image",
          message: "Choose a prepared plant photo (JPEG/PNG/WEBP, at least 512x512) before identifying.",
        });
        return;
      }

      onReset();
      const identifyMessage = options.fromRetry
        ? getReidentifyStatus(images.length)
        : getIdentifyingStatus();
      onStatus({ kind: "identifying", message: identifyMessage });
      onError(null);

      const token = startRun();
      let results: IdentificationCandidate[] = [];
      try {
        results = await identify({
          images: images.map((image, index) => ({
            data: image.file,
            filename: image.file.name ?? `photo-${index + 1}.jpg`,
            contentType: image.file.type,
          })),
          limit: 3,
        });
        if (isRunStale(token)) {
          return;
        }
      } catch (err) {
        if (!isRunStale(token)) {
          onStatus(null);
          const message =
            err instanceof PlantNetError
              ? err.message
              : (err as Error).message ?? "Failed to identify species. Try manual entry.";
          onError({ type: "identify", message });
          onManualModeChange(true);
          setManualRecommended(false);
        }
        return;
      } finally {
        finishRun(token);
      }

      if (!results.length) {
        onStatus(null);
        onError({
          type: "identify",
          message: "No species candidates returned. Try another photo or use manual entry.",
        });
        onManualModeChange(true);
        setManualRecommended(false);
        return;
      }

      setCandidates(results);
      const topCandidate = results[0];
      setSelectedKey(topCandidate.speciesKey);

      const assessment = assessConfidence(results);
      setConfidence(assessment);

      if (assessment.level === "low") {
        const reachedLimit = images.length >= maxPhotos;
        onStatus({
          kind: "confidence-low",
          message: getLowConfidenceStatus(assessment, { reachedLimit }),
        });
        setManualRecommended(reachedLimit);
        if (reachedLimit) {
          onManualModeChange(true);
        }
        return;
      }

      setManualRecommended(false);
      if (plantNetConfigured) {
        onManualModeChange(false);
      }
      await runPolicyForCandidate(topCandidate);
    },
    [
      finishRun,
      identify,
      isRunStale,
      maxPhotos,
      onError,
      onManualModeChange,
      onReset,
      onStatus,
      plantNetConfigured,
      runPolicyForCandidate,
      setSelectedKey,
      startRun,
    ],
  );

  const handleSelectCandidate = useCallback(
    async (speciesKey: string) => {
      const candidate = candidates.find((entry) => entry.speciesKey === speciesKey) ?? null;
      if (!candidate) return;
      setSelectedKey(speciesKey);

      if (confidence?.level === "low") {
        const preparedCount = getPreparedImages().length;
        const reachedLimit = preparedCount >= maxPhotos;
        onStatus({
          kind: "confidence-low",
          message: confidence ? getLowConfidenceStatus(confidence, { reachedLimit }) : "",
        });
        setManualRecommended(reachedLimit);
        return;
      }

      await runPolicyForCandidate(candidate);
    },
    [
      candidates,
      confidence,
      getPreparedImages,
      maxPhotos,
      onStatus,
      runPolicyForCandidate,
      setManualRecommended,
      setSelectedKey,
    ],
  );

  const applyManualCandidate = useCallback(
    async (candidate: IdentificationCandidate) => {
      setCandidates([candidate]);
      setSelectedKey(candidate.speciesKey);
      setConfidence(null);
      setManualRecommended(false);
      await runPolicyForCandidate(candidate);
    },
    [runPolicyForCandidate, setSelectedKey],
  );

  return {
    candidates,
    confidence,
    manualRecommended,
    identifyWithImages,
    handleSelectCandidate,
    applyManualCandidate,
    reset,
    clearAssessments,
  };
};
