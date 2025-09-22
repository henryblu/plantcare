import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { SpeciesProfile } from "@core/models/speciesProfile";
import type { IdentificationCandidate } from "@services/id/types";
import { ImageValidationError, prepareImageFile } from "@app/utils/imageProcessing";
import { PlantNetError } from "@services/id/plantNet";
import { usePlantCareServices } from "../providers/PlantCareProvider";
import ManualEntryForm, { ManualEntryDraft } from "@app/features/addPlant/components/ManualEntryForm";
import CandidateList from "@app/features/addPlant/components/CandidateList";
import PolicySummary from "@app/features/addPlant/components/PolicySummary";
import {
  buildPolicyRequest,
  getCacheHitStatus,
  getIdentifyingStatus,
  getImageProcessingStatus,
  getImageReadyStatus,
  getPolicyGenerationStatus,
  getPolicyReadyStatus,
} from "@app/features/addPlant/utils";

interface ProcessedImageMeta {
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  wasDownscaled: boolean;
}

type StatusKind =
  | "image-processing"
  | "image-ready"
  | "identifying"
  | "policy-cache"
  | "policy-loading"
  | "policy-ready";

interface UiStatus {
  kind: StatusKind;
  message: string;
}

type ErrorKind = "image" | "identify" | "policy" | "manual";

interface UiError {
  type: ErrorKind;
  message: string;
}

const AddPlantScreen = () => {
  const {
    plantNetConfigured,
    openAiConfigured,
    identify,
    resolvePolicy,
    manualCandidate,
  } = usePlantCareServices();

  const [file, setFile] = useState<File | null>(null);
  const [imageMeta, setImageMeta] = useState<ProcessedImageMeta | null>(null);
  const [candidates, setCandidates] = useState<IdentificationCandidate[]>([]);
  const [profiles, setProfiles] = useState<Record<string, SpeciesProfile>>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [status, setStatus] = useState<UiStatus | null>(null);
  const [error, setError] = useState<UiError | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualMode, setManualMode] = useState(!plantNetConfigured);
  const [manualDraft, setManualDraft] = useState<ManualEntryDraft>({
    canonicalName: "",
    commonName: "",
    type: "other",
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileProcessRef = useRef(0);
  const latestRunRef = useRef(0);

  useEffect(() => {
    if (!plantNetConfigured) {
      setManualMode(true);
    }
  }, [plantNetConfigured]);

  const selectedCandidate = useMemo(
    () => (selectedKey ? candidates.find((candidate) => candidate.speciesKey === selectedKey) ?? null : null),
    [candidates, selectedKey],
  );

  const selectedProfile = useMemo(
    () => (selectedKey ? profiles[selectedKey] ?? null : null),
    [profiles, selectedKey],
  );

  const startRun = () => {
    latestRunRef.current += 1;
    setIsProcessing(true);
    return latestRunRef.current;
  };

  const finishRun = (token: number) => {
    if (latestRunRef.current === token) {
      setIsProcessing(false);
    }
  };

  const resetResults = () => {
    setCandidates([]);
    setProfiles({});
    setSelectedKey(null);
    setStatus(null);
    setError(null);
  };

  const triggerPhotoPicker = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    const token = fileProcessRef.current + 1;
    fileProcessRef.current = token;

    setFile(null);
    setImageMeta(null);
    resetResults();

    if (!selected) {
      return;
    }

    setStatus({ kind: "image-processing", message: getImageProcessingStatus() });

    try {
      const prepared = await prepareImageFile(selected);
      if (fileProcessRef.current !== token) {
        return;
      }

      setFile(prepared.file);
      const meta: ProcessedImageMeta = {
        width: prepared.width,
        height: prepared.height,
        originalWidth: prepared.originalWidth,
        originalHeight: prepared.originalHeight,
        wasDownscaled: prepared.wasDownscaled,
      };
      setImageMeta(meta);
      setStatus({ kind: "image-ready", message: getImageReadyStatus(meta) });
      setError(null);
      if (plantNetConfigured) {
        setManualMode(false);
      }
    } catch (err) {
      if (fileProcessRef.current !== token) {
        return;
      }
      const message =
        err instanceof ImageValidationError
          ? err.message
          : (err as Error).message ?? "Could not process the selected image.";
      setStatus(null);
      setError({ type: "image", message });
      setFile(null);
      setImageMeta(null);
      event.target.value = "";
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const runPolicyForCandidate = async (
    candidate: IdentificationCandidate,
    options?: { forceRefresh?: boolean },
  ) => {
    if (!candidate) return;

    const existingProfile = profiles[candidate.speciesKey];
    if (existingProfile && !options?.forceRefresh) {
      setSelectedKey(candidate.speciesKey);
      setStatus({ kind: "policy-cache", message: getCacheHitStatus() });
      return;
    }

    const runToken = startRun();
    try {
      setStatus({ kind: "policy-loading", message: getPolicyGenerationStatus(options?.forceRefresh) });
      setError(null);
      const profile = await resolvePolicy(buildPolicyRequest(candidate), options);
      if (latestRunRef.current !== runToken) {
        return;
      }
      setProfiles((prev) => ({
        ...prev,
        [candidate.speciesKey]: profile,
      }));
      setSelectedKey(candidate.speciesKey);
      setStatus({ kind: "policy-ready", message: getPolicyReadyStatus() });
    } catch (err) {
      if (latestRunRef.current === runToken) {
        setStatus(null);
        setError({
          type: "policy",
          message: (err as Error).message ?? "Failed to generate a care guide.",
        });
      }
    } finally {
      finishRun(runToken);
    }
  };

  const handleIdentify = async () => {
    if (!plantNetConfigured) {
      setManualMode(true);
      setError({
        type: "identify",
        message: "PlantNet service is not configured. Use manual entry instead.",
      });
      return;
    }
    if (!file) {
      setError({
        type: "image",
        message: "Choose a prepared plant photo (JPEG/PNG/WEBP, at least 512x512) before identifying.",
      });
      fileInputRef.current?.focus();
      return;
    }

    resetResults();
    setStatus({ kind: "identifying", message: getIdentifyingStatus() });
    setError(null);

    const runToken = startRun();
    let results: IdentificationCandidate[] = [];
    try {
      results = await identify({
        images: [
          {
            data: file,
            filename: file.name,
            contentType: file.type,
          },
        ],
        limit: 3,
      });
      if (latestRunRef.current !== runToken) {
        return;
      }
    } catch (err) {
      if (latestRunRef.current === runToken) {
        setStatus(null);
        const message =
          err instanceof PlantNetError
            ? err.message
            : (err as Error).message ?? "Failed to identify species. Try manual entry.";
        setError({ type: "identify", message });
        setManualMode(true);
      }
      return;
    } finally {
      finishRun(runToken);
    }

    if (!results.length) {
      setStatus(null);
      setError({
        type: "identify",
        message: "No species candidates returned. Try another photo or use manual entry.",
      });
      setManualMode(true);
      return;
    }

    setCandidates(results);
    setSelectedKey(results[0].speciesKey);
    setManualMode(false);
    await runPolicyForCandidate(results[0]);
  };

  const handleSelectCandidate = async (speciesKey: string) => {
    const candidate = candidates.find((entry) => entry.speciesKey === speciesKey);
    if (!candidate) return;
    setSelectedKey(speciesKey);
    await runPolicyForCandidate(candidate);
  };

  const handleManualSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      const candidate = manualCandidate({
        canonicalName: manualDraft.canonicalName,
        commonName: manualDraft.commonName || undefined,
        type: manualDraft.type,
      });
      setCandidates([candidate]);
      setSelectedKey(candidate.speciesKey);
      await runPolicyForCandidate(candidate);
    } catch (err) {
      setError({
        type: "manual",
        message: (err as Error).message ?? "Manual entry failed.",
      });
    }
  };

  const handleRetry = () => {
    if (!error || isProcessing) return;

    if (error.type === "identify") {
      if (!file || !plantNetConfigured) {
        triggerPhotoPicker();
        return;
      }
      setError(null);
      void handleIdentify();
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
  };

  const handleChooseDifferentPhoto = () => {
    if (isProcessing) return;
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    triggerPhotoPicker();
  };

  const retryAvailable =
    error?.type === "identify"
      ? Boolean(file && plantNetConfigured && !isProcessing)
      : error?.type === "policy"
        ? Boolean(selectedCandidate && !isProcessing)
        : false;

  const choosePhotoAvailable = Boolean(
    error && !isProcessing && (error.type === "image" || error.type === "identify" || error.type === "policy"),
  );

  const statusSpinnerLabel =
    status?.kind === "identifying" ? "PlantNet" : status?.kind === "policy-loading" ? "ChatGPT" : null;

  return (
    <div className="content-stack">
      <section className="page-hero">
        <div>
          <h1>Plant Care Guide</h1>
          <p>Upload a plant photo or enter the species manually to craft a personalised moisture policy.</p>
        </div>
        <div className="hero-status">
          <span className={`chip ${plantNetConfigured ? "chip--success" : "chip--warning"}`}>
            {plantNetConfigured ? "PlantNet connected" : "PlantNet needs setup"}
          </span>
          <span className={`chip ${openAiConfigured ? "chip--success" : "chip--info"}`}>
            {openAiConfigured ? "AI guidance live" : "Using default policies"}
          </span>
        </div>
      </section>

      <section className="card card--form">
        <div>
          <h3>Identify your plant</h3>
          <p className="muted-text">
            Upload a clear photo to identify likely species or toggle manual entry if you already know the name.
          </p>
        </div>

        <div className="form-grid">
          <label>
            Plant photo
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              disabled={isProcessing}
            />
            {imageMeta && (
              <small className="muted-text">
                Prepared image: {imageMeta.width}x{imageMeta.height}px
                {imageMeta.wasDownscaled ? (
                  <> (down from {imageMeta.originalWidth}x{imageMeta.originalHeight}px)</>
                ) : null}
                .
              </small>
            )}
          </label>
        </div>

        <div className="button-row">
          <button
            className="primary-button"
            onClick={handleIdentify}
            disabled={isProcessing || !file || !plantNetConfigured}
          >
            {isProcessing ? "Working..." : "Identify & Generate"}
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setManualMode((value) => !value)}
            disabled={isProcessing}
          >
            {manualMode ? "Hide manual entry" : "Enter species manually"}
          </button>
        </div>

        {!plantNetConfigured && (
          <div className="error-banner">
            PlantNet service is not configured. Set <code>PLANTNET_API_KEY</code> and restart the dev server, or use manual entry below.
          </div>
        )}

        {!openAiConfigured && (
          <div className="status-banner">
            Policy service fallback in use. Seeded defaults will be applied when ChatGPT is unavailable.
          </div>
        )}

        {status && (
          <div className={`status-banner${statusSpinnerLabel ? " status-banner--progress" : ""}`}>
            {statusSpinnerLabel && (
              <div className="status-banner__progress" aria-live="polite">
                <span className="spinner" aria-hidden="true" />
                <span className="spinner-label">{statusSpinnerLabel}</span>
              </div>
            )}
            <span>{status.message}</span>
          </div>
        )}

        {error && (
          <div className="error-banner error-banner--inline">
            <div className="error-banner__message">{error.message}</div>
            {(retryAvailable || choosePhotoAvailable) && (
              <div className="error-banner__actions">
                {retryAvailable && (
                  <button type="button" className="tertiary-button" onClick={handleRetry} disabled={isProcessing}>
                    Try again
                  </button>
                )}
                {choosePhotoAvailable && (
                  <button
                    type="button"
                    className="tertiary-button"
                    onClick={handleChooseDifferentPhoto}
                    disabled={isProcessing}
                  >
                    Choose different photo
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {manualMode && (
        <ManualEntryForm
          draft={manualDraft}
          onChange={setManualDraft}
          onSubmit={handleManualSubmit}
          disabled={isProcessing}
        />
      )}

      <CandidateList
        candidates={candidates}
        selectedKey={selectedKey}
        onSelect={handleSelectCandidate}
        disabled={isProcessing}
      />

      {selectedCandidate && selectedProfile && (
        <PolicySummary candidate={selectedCandidate} profile={selectedProfile} />
      )}
    </div>
  );
};

export default AddPlantScreen;
