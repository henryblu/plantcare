import { useCallback, useRef, useState } from "react";
import type { ChangeEvent, MutableRefObject } from "react";

import {
  getImageProcessingStatus,
  getImageReadyStatus,
} from "@app/features/addPlant/utils";
import {
  ImageValidationError,
  prepareImageFile,
  type PreparedImageFile,
} from "@app/utils/imageProcessing";

import type { UiError, UiStatus } from "./types";

export type PhotoChangeReason = "primary" | "additional";

export interface UseImagePreparationOptions {
  plantNetConfigured: boolean;
  maxPhotos: number;
  onResetResults: () => void;
  onStatus: (status: UiStatus | null) => void;
  onError: (error: UiError | null) => void;
  onManualModeChange: (enabled: boolean) => void;
  onAssessmentsCleared: () => void;
  onPhotosPrepared?: (images: PreparedImageFile[], context: { reason: PhotoChangeReason }) => void;
}

export interface UseImagePreparationResult {
  fileInputRef: MutableRefObject<HTMLInputElement | null>;
  additionalFileInputRef: MutableRefObject<HTMLInputElement | null>;
  preparedImages: PreparedImageFile[];
  describePreparedImage: (image: PreparedImageFile, index: number) => string;
  handleFileChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void> | void;
  handleAdditionalPhotoChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void> | void;
  handleChooseDifferentPhoto: () => void;
  triggerPhotoPicker: () => void;
  triggerAdditionalPhotoPicker: () => void;
}

const describePreparedImage = (image: PreparedImageFile, index: number): string => {
  const label = index === 0 ? "Primary photo" : `Photo ${index + 1}`;
  const size = `${image.width}x${image.height}px`;
  const detail = image.wasDownscaled
    ? ` (down from ${image.originalWidth}x${image.originalHeight}px)`
    : "";
  return `${label}: ${size}${detail}.`;
};

export const useImagePreparation = ({
  plantNetConfigured,
  maxPhotos,
  onResetResults,
  onStatus,
  onError,
  onManualModeChange,
  onAssessmentsCleared,
  onPhotosPrepared,
}: UseImagePreparationOptions): UseImagePreparationResult => {
  const [preparedImages, setPreparedImages] = useState<PreparedImageFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const additionalFileInputRef = useRef<HTMLInputElement | null>(null);
  const fileProcessRef = useRef(0);

  const triggerPhotoPicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const triggerAdditionalPhotoPicker = useCallback(() => {
    additionalFileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const selected = event.target.files?.[0] ?? null;
      fileProcessRef.current += 1;
      const token = fileProcessRef.current;

      setPreparedImages([]);
      onResetResults();

      if (!selected) {
        return;
      }

      onStatus({ kind: "image-processing", message: getImageProcessingStatus() });

      try {
        const prepared = await prepareImageFile(selected);
        if (fileProcessRef.current !== token) {
          return;
        }

        const nextImages = [prepared];
        setPreparedImages(nextImages);
        onStatus({ kind: "image-ready", message: getImageReadyStatus(prepared) });
        onError(null);
        onAssessmentsCleared();
        if (plantNetConfigured) {
          onManualModeChange(false);
        }
        onPhotosPrepared?.(nextImages, { reason: "primary" });
      } catch (err) {
        if (fileProcessRef.current !== token) {
          return;
        }
        const message =
          err instanceof ImageValidationError
            ? err.message
            : (err as Error).message ?? "Could not process the selected image.";
        onStatus(null);
        onError({ type: "image", message });
        setPreparedImages([]);
        event.target.value = "";
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [onAssessmentsCleared, onError, onPhotosPrepared, onResetResults, onStatus, onManualModeChange, plantNetConfigured],
  );

  const handleAdditionalPhotoChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const selected = event.target.files?.[0] ?? null;
      event.target.value = "";
      if (!selected) {
        return;
      }

      if (preparedImages.length >= maxPhotos) {
        return;
      }

      fileProcessRef.current += 1;
      const token = fileProcessRef.current;
      onStatus({ kind: "image-processing", message: getImageProcessingStatus() });

      try {
        const prepared = await prepareImageFile(selected);
        if (fileProcessRef.current !== token) {
          return;
        }

        const nextImages = [...preparedImages, prepared];
        setPreparedImages(nextImages);
        const photoIndex = nextImages.length;
        const readyMessage =
          photoIndex > 1
            ? `Added photo ${photoIndex}. ${getImageReadyStatus(prepared)}`
            : getImageReadyStatus(prepared);
        onStatus({ kind: "image-ready", message: readyMessage });
        onError(null);
        onAssessmentsCleared();
        onPhotosPrepared?.(nextImages, { reason: "additional" });
      } catch (err) {
        if (fileProcessRef.current !== token) {
          return;
        }
        const message =
          err instanceof ImageValidationError
            ? err.message
            : (err as Error).message ?? "Could not process the selected image.";
        onStatus(null);
        onError({ type: "image", message });
      }
    },
    [maxPhotos, onAssessmentsCleared, onError, onPhotosPrepared, onStatus, preparedImages],
  );

  const handleChooseDifferentPhoto = useCallback(() => {
    onError(null);
    onAssessmentsCleared();
    onResetResults();
    setPreparedImages([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (additionalFileInputRef.current) {
      additionalFileInputRef.current.value = "";
    }
    triggerPhotoPicker();
  }, [onAssessmentsCleared, onError, onResetResults, triggerPhotoPicker]);

  return {
    fileInputRef,
    additionalFileInputRef,
    preparedImages,
    describePreparedImage,
    handleFileChange,
    handleAdditionalPhotoChange,
    handleChooseDifferentPhoto,
    triggerPhotoPicker,
    triggerAdditionalPhotoPicker,
  };
};
