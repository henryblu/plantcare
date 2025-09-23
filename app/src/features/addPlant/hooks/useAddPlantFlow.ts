import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, MutableRefObject } from "react";

import { ADDITIONAL_PHOTO_GUIDANCE, type ConfidenceAssessment } from "@app/features/addPlant/utils";
import type { ManualEntryDraft } from "@app/features/addPlant/components/ManualEntryForm";
import { useIdentificationFlow } from "@app/features/addPlant/hooks/useIdentificationFlow";
import { useImagePreparation } from "@app/features/addPlant/hooks/useImagePreparation";
import { usePolicyResolution } from "@app/features/addPlant/hooks/usePolicyResolution";
import type { UiError, UiStatus } from "@app/features/addPlant/hooks/types";
import type { PreparedImageFile } from "@app/utils/imageProcessing";
import type {
  IdentificationCandidate,
  IdentifyRequest,
  ManualEntryInput,
} from "@services/id/types";
import type { PolicyGenerationRequest } from "@services/policy/chatgpt";
import type { SpeciesProfile } from "@core/models/speciesProfile";
import type { ResolvePolicyOptions } from "@core/orchestration/cacheFlow";

export const DEFAULT_MAX_PHOTOS = 3;

export interface UseAddPlantFlowOptions {
  identify: (request: IdentifyRequest) => Promise<IdentificationCandidate[]>;
  resolvePolicy: (
    request: PolicyGenerationRequest,
    options?: ResolvePolicyOptions,
  ) => Promise<SpeciesProfile>;
  manualCandidate: (input: ManualEntryInput) => IdentificationCandidate;
  plantNetConfigured: boolean;
  maxPhotos?: number;
}

export interface UseAddPlantFlowResult {
  fileInputRef: MutableRefObject<HTMLInputElement | null>;
  additionalFileInputRef: MutableRefObject<HTMLInputElement | null>;
  preparedImages: PreparedImageFile[];
  candidates: IdentificationCandidate[];
  selectedKey: string | null;
  selectedCandidate: IdentificationCandidate | null;
  selectedProfile: SpeciesProfile | null;
  status: UiStatus | null;
  error: UiError | null;
  isProcessing: boolean;
  manualMode: boolean;
  manualRecommended: boolean;
  confidence: ConfidenceAssessment | null;
  manualDraft: ManualEntryDraft;
  retryAvailable: boolean;
  choosePhotoAvailable: boolean;
  statusSpinnerLabel: string | null;
  additionalPhotosRemaining: number;
  canAddMorePhotos: boolean;
  nextPhotoHint: string | null;
  describePreparedImage: (image: PreparedImageFile, index: number) => string;
  handleFileChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void> | void;
  handleAdditionalPhotoChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void> | void;
  handleIdentify: () => Promise<void>;
  handleSelectCandidate: (speciesKey: string) => Promise<void>;
  handleManualSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleManualDraftChange: (next: ManualEntryDraft) => void;
  handleRetry: () => void;
  handleChooseDifferentPhoto: () => void;
  toggleManualMode: () => void;
  enableManualMode: () => void;
  triggerAdditionalPhotoPicker: () => void;
}

export const useAddPlantFlow = ({
  identify,
  resolvePolicy,
  manualCandidate,
  plantNetConfigured,
  maxPhotos = DEFAULT_MAX_PHOTOS,
}: UseAddPlantFlowOptions): UseAddPlantFlowResult => {
  const [status, setStatus] = useState<UiStatus | null>(null);
  const [error, setError] = useState<UiError | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualMode, setManualMode] = useState(!plantNetConfigured);
  const [manualDraft, setManualDraft] = useState<ManualEntryDraft>({
    canonicalName: "",
    commonName: "",
    type: "other",
  });

  const latestRunRef = useRef(0);
  const preparedImagesRef = useRef<PreparedImageFile[]>([]);

  useEffect(() => {
    if (!plantNetConfigured) {
      setManualMode(true);
    }
  }, [plantNetConfigured]);

  const startRun = useCallback(() => {
    latestRunRef.current += 1;
    setIsProcessing(true);
    return latestRunRef.current;
  }, []);

  const finishRun = useCallback((token: number) => {
    if (latestRunRef.current === token) {
      setIsProcessing(false);
    }
  }, []);

  const isRunStale = useCallback((token: number) => latestRunRef.current !== token, []);

  const resetStatusAndError = useCallback(() => {
    setStatus(null);
    setError(null);
  }, []);

  const {
    selectedKey,
    selectedProfile,
    runPolicyForCandidate,
    setSelectedKey,
    reset: resetPolicy,
  } = usePolicyResolution({
    resolvePolicy,
    onStatus: setStatus,
    onError: setError,
    startRun,
    finishRun,
    isRunStale,
  });

  const {
    candidates,
    confidence,
    manualRecommended,
    identifyWithImages,
    handleSelectCandidate,
    applyManualCandidate,
    reset: resetIdentification,
    clearAssessments,
  } = useIdentificationFlow({
    identify,
    plantNetConfigured,
    maxPhotos,
    getPreparedImages: () => preparedImagesRef.current,
    onReset: () => {
      resetPolicy();
      resetStatusAndError();
    },
    onStatus: setStatus,
    onError: setError,
    onManualModeChange: setManualMode,
    runPolicyForCandidate,
    setSelectedKey,
    startRun,
    finishRun,
    isRunStale,
  });

  const resetAllResults = useCallback(() => {
    preparedImagesRef.current = [];
    resetIdentification();
    resetPolicy();
    resetStatusAndError();
  }, [resetIdentification, resetPolicy, resetStatusAndError]);

  const {
    fileInputRef,
    additionalFileInputRef,
    preparedImages,
    describePreparedImage,
    handleFileChange,
    handleAdditionalPhotoChange,
    handleChooseDifferentPhoto,
    triggerPhotoPicker,
    triggerAdditionalPhotoPicker,
  } = useImagePreparation({
    plantNetConfigured,
    maxPhotos,
    onResetResults: resetAllResults,
    onStatus: setStatus,
    onError: setError,
    onManualModeChange: setManualMode,
    onAssessmentsCleared: clearAssessments,
    onPhotosPrepared: (images, context) => {
      preparedImagesRef.current = images;
      if (context.reason === "additional") {
        void identifyWithImages(images, { fromRetry: true });
      }
    },
  });

  useEffect(() => {
    preparedImagesRef.current = preparedImages;
  }, [preparedImages]);

  const selectedCandidate = useMemo(() => {
    if (!selectedKey) return null;
    return candidates.find((candidate) => candidate.speciesKey === selectedKey) ?? null;
  }, [candidates, selectedKey]);

  const handleIdentify = useCallback(async () => {
    if (!plantNetConfigured) {
      setManualMode(true);
      setError({
        type: "identify",
        message: "PlantNet service is not configured. Use manual entry instead.",
      });
      return;
    }

    if (preparedImages.length === 0) {
      setError({
        type: "image",
        message: "Choose a prepared plant photo (JPEG/PNG/WEBP, at least 512x512) before identifying.",
      });
      fileInputRef.current?.focus();
      return;
    }

    await identifyWithImages(preparedImages);
  }, [identifyWithImages, plantNetConfigured, preparedImages]);

  const handleManualSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);

      try {
        const candidate = manualCandidate({
          canonicalName: manualDraft.canonicalName,
          commonName: manualDraft.commonName || undefined,
          type: manualDraft.type,
        });
        await applyManualCandidate(candidate);
      } catch (err) {
        setError({
          type: "manual",
          message: (err as Error).message ?? "Manual entry failed.",
        });
      }
    },
    [applyManualCandidate, manualCandidate, manualDraft],
  );

  const handleManualDraftChange = useCallback((next: ManualEntryDraft) => {
    setManualDraft(next);
  }, []);

  const handleRetry = useCallback(() => {
    if (!error || isProcessing) return;

    if (error.type === "identify") {
      if (preparedImages.length === 0 || !plantNetConfigured) {
        triggerPhotoPicker();
        return;
      }
      setError(null);
      void identifyWithImages(preparedImages, { fromRetry: true });
      return;
    }

    if (error.type === "policy" && selectedCandidate) {
      setError(null);
      void runPolicyForCandidate(selectedCandidate, { forceRefresh: true });
      return;
    }

    if (error.type === "image") {
      setError(null);
      triggerPhotoPicker();
    }
  }, [
    error,
    identifyWithImages,
    isProcessing,
    plantNetConfigured,
    preparedImages,
    runPolicyForCandidate,
    selectedCandidate,
    triggerPhotoPicker,
  ]);

  const toggleManualMode = useCallback(() => {
    setManualMode((value) => !value);
  }, []);

  const enableManualMode = useCallback(() => {
    setManualMode(true);
  }, []);

  const retryAvailable = useMemo(() => {
    if (!error) return false;
    if (error.type === "identify") {
      return preparedImages.length > 0 && plantNetConfigured && !isProcessing;
    }
    if (error.type === "policy") {
      return Boolean(selectedCandidate && !isProcessing);
    }
    return false;
  }, [error, isProcessing, plantNetConfigured, preparedImages.length, selectedCandidate]);

  const choosePhotoAvailable = useMemo(() => {
    if (!error || isProcessing) return false;
    return error.type === "image" || error.type === "identify" || error.type === "policy";
  }, [error, isProcessing]);

  const statusSpinnerLabel = useMemo(() => {
    if (status?.kind === "identifying") return "PlantNet";
    if (status?.kind === "policy-loading") return "ChatGPT";
    return null;
  }, [status]);

  const additionalPhotosRemaining = useMemo(
    () => Math.max(0, maxPhotos - preparedImages.length),
    [maxPhotos, preparedImages.length],
  );

  const canAddMorePhotos = useMemo(
    () => confidence?.level === "low" && preparedImages.length < maxPhotos,
    [confidence, maxPhotos, preparedImages.length],
  );

  const nextPhotoHint = useMemo(() => {
    if (!canAddMorePhotos) return null;
    if (preparedImages.length >= 1 && preparedImages.length - 1 < ADDITIONAL_PHOTO_GUIDANCE.length) {
      return ADDITIONAL_PHOTO_GUIDANCE[preparedImages.length - 1];
    }
    return null;
  }, [canAddMorePhotos, preparedImages.length]);

  return {
    fileInputRef,
    additionalFileInputRef,
    preparedImages,
    candidates,
    selectedKey,
    selectedCandidate,
    selectedProfile,
    status,
    error,
    isProcessing,
    manualMode,
    manualRecommended,
    confidence,
    manualDraft,
    retryAvailable,
    choosePhotoAvailable,
    statusSpinnerLabel,
    additionalPhotosRemaining,
    canAddMorePhotos,
    nextPhotoHint,
    describePreparedImage,
    handleFileChange,
    handleAdditionalPhotoChange,
    handleIdentify,
    handleSelectCandidate,
    handleManualSubmit,
    handleManualDraftChange,
    handleRetry,
    handleChooseDifferentPhoto,
    toggleManualMode,
    enableManualMode,
    triggerAdditionalPhotoPicker,
  };
};

export type { ConfidenceAssessment } from "@app/features/addPlant/utils";
export type { IdentificationCandidate } from "@services/id/types";
export type { StatusKind, UiStatus, UiError } from "@app/features/addPlant/hooks/types";
