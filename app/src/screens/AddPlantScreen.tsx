import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Stepper, { type StepDefinition } from "@app/components/Stepper";
import ManualEntryForm from "@app/features/addPlant/components/ManualEntryForm";
import CandidateList from "@app/features/addPlant/components/CandidateList";
import PolicySummary from "@app/features/addPlant/components/PolicySummary";
import { useAddPlantFlow } from "@app/features/addPlant/hooks/useAddPlantFlow";
import { buildPolicyRequest, formatPercentage } from "@app/features/addPlant/utils";
import {
  DEFAULT_ADD_STEP,
  isValidAddStep,
  type AddRouteStep,
} from "@app/features/addPlant/constants";
import { usePlantCareServices } from "../providers/PlantCareProvider";
import { useNavigation } from "../navigation/router";

const STEP_DEFINITIONS: StepDefinition<AddRouteStep>[] = [
  {
    key: "photo",
    title: "Photo",
    description: "Upload or adjust your plant photo",
  },
  {
    key: "candidates",
    title: "Matches",
    description: "Review suggestions or enter the species manually",
  },
  {
    key: "confirm",
    title: "Care guide",
    description: "Check the policy and save to Home",
  },
];

const AddPlantScreen = () => {
  const { plantNetConfigured, openAiConfigured, identify, resolvePolicy, manualCandidate, createPlant } =
    usePlantCareServices();
  const { location, navigate, buildPath } = useNavigation();

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const stepParam = searchParams.get("step");
  const currentStep: AddRouteStep = isValidAddStep(stepParam) ? stepParam : DEFAULT_ADD_STEP;

  const {
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
  } = useAddPlantFlow({
    identify,
    resolvePolicy,
    manualCandidate,
    plantNetConfigured,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const setStep = useCallback(
    (nextStep: AddRouteStep, options: { replace?: boolean } = {}) => {
      const params = new URLSearchParams(location.search);
      params.set("step", nextStep);
      navigate(buildPath("/add", params.toString()), options);
    },
    [buildPath, location.search, navigate],
  );

  const replaceStep = useCallback((nextStep: AddRouteStep) => setStep(nextStep, { replace: true }), [setStep]);

  const candidateSignature = useMemo(
    () => candidates.map((candidate) => candidate.speciesKey).join("|"),
    [candidates],
  );
  const lastCandidateSignatureRef = useRef<string>("");

  useEffect(() => {
    if (status?.kind === "identifying") {
      lastCandidateSignatureRef.current = "";
    }
  }, [status]);

  useEffect(() => {
    if (!candidateSignature) {
      lastCandidateSignatureRef.current = "";
      if (!manualMode && currentStep !== "photo" && !isProcessing) {
        replaceStep("photo");
      }
      return;
    }

    if (lastCandidateSignatureRef.current !== candidateSignature && currentStep === "photo") {
      replaceStep("candidates");
    }
    lastCandidateSignatureRef.current = candidateSignature;
  }, [candidateSignature, currentStep, isProcessing, manualMode, replaceStep]);

  useEffect(() => {
    if (currentStep === "confirm" && (!selectedCandidate || !selectedProfile)) {
      if (manualMode || candidates.length > 0) {
        replaceStep("candidates");
      } else {
        replaceStep("photo");
      }
    }
  }, [candidates.length, currentStep, manualMode, replaceStep, selectedCandidate, selectedProfile]);

  useEffect(() => {
    if (!selectedCandidate || !selectedProfile) return;
    if (currentStep !== "confirm") {
      replaceStep("confirm");
    }
  }, [currentStep, replaceStep, selectedCandidate, selectedProfile]);

  const confidenceChipTone = confidence
    ? confidence.level === "high"
      ? "chip--success"
      : confidence.level === "medium"
        ? "chip--info"
        : "chip--warning"
    : "chip--info";

  const confidenceLabel = confidence
    ? `${confidence.level.charAt(0).toUpperCase()}${confidence.level.slice(1)}`
    : null;

  const addButtonLabel = isSaving ? "Adding..." : "Add to my garden";

  const canAddPlant = useMemo(
    () => Boolean(selectedCandidate && selectedProfile && !isProcessing && !isSaving),
    [isProcessing, isSaving, selectedCandidate, selectedProfile],
  );

  useEffect(() => {
    setSaveError(null);
    setIsSaving(false);
  }, [selectedKey]);

  const handleAddPlant = useCallback(async () => {
    if (!selectedCandidate || !selectedProfile || isSaving || isProcessing) {
      return;
    }

    setSaveError(null);
    setIsSaving(true);
    try {
      await createPlant({
        species: buildPolicyRequest(selectedCandidate),
        plant: {},
      });
      navigate(buildPath("/", ""), { replace: true });
    } catch (error) {
      console.error("[AddPlantScreen] Failed to add plant", error);
      setSaveError((error as Error).message ?? "Failed to add plant. Try again.");
    } finally {
      setIsSaving(false);
    }
  }, [
    buildPath,
    createPlant,
    isProcessing,
    isSaving,
    navigate,
    selectedCandidate,
    selectedProfile,
  ]);

  const handleManualToggle = useCallback(() => {
    const nextManual = !manualMode;
    toggleManualMode();
    if (nextManual) {
      if (currentStep !== "candidates") {
        replaceStep("candidates");
      }
    } else if (!candidates.length && currentStep !== "photo") {
      replaceStep("photo");
    }
  }, [candidates.length, currentStep, manualMode, replaceStep, toggleManualMode]);

  const handleEnableManualMode = useCallback(() => {
    if (!manualMode && currentStep !== "candidates") {
      replaceStep("candidates");
    }
    enableManualMode();
  }, [currentStep, enableManualMode, manualMode, replaceStep]);

  const disableNavigation = isProcessing || isSaving;
  const canStepBack = currentStep !== "photo";

  const handleStepBack = useCallback(() => {
    if (!canStepBack || disableNavigation) return;
    if (currentStep === "confirm") {
      setStep("candidates");
      return;
    }
    setStep("photo");
  }, [canStepBack, currentStep, disableNavigation, setStep]);

  const hasProgress = useMemo(
    () =>
      preparedImages.length > 0 ||
      candidates.length > 0 ||
      Boolean(selectedProfile) ||
      manualDraft.canonicalName.trim().length > 0,
    [candidates.length, manualDraft.canonicalName, preparedImages.length, selectedProfile],
  );

  const handleCancel = useCallback(() => {
    if (disableNavigation) return;
    const shouldExit = !hasProgress
      ? true
      : window.confirm("Exit add plant? Your uploaded photos and selections will be cleared.");
    if (!shouldExit) return;
    navigate(buildPath("/", ""), { replace: true });
  }, [buildPath, disableNavigation, hasProgress, navigate]);

  const handleBackToCandidates = useCallback(() => {
    if (disableNavigation || currentStep === "candidates") return;
    setStep("candidates");
  }, [currentStep, disableNavigation, setStep]);

  const handleGoToSummary = useCallback(() => {
    if (disableNavigation || !selectedCandidate || !selectedProfile || currentStep === "confirm") return;
    setStep("confirm");
  }, [currentStep, disableNavigation, selectedCandidate, selectedProfile, setStep]);

  const showConfidence = Boolean(confidence && currentStep !== "photo");
  const confidenceLevel = confidence?.level ?? null;
  const showConfidenceNotice = Boolean(confidenceLevel && confidenceLevel !== "high" && currentStep !== "photo");
  const isLowConfidence = confidenceLevel === "low";
  const showManualRecommended = manualRecommended && currentStep !== "photo";
  const showManualEntryForm = manualMode && currentStep === "candidates";
  const showCandidates = candidates.length > 0 && currentStep === "candidates";
  const showSummary = Boolean(selectedCandidate && selectedProfile && currentStep === "confirm");
  const canViewSummary = Boolean(selectedCandidate && selectedProfile);

  return (
    <div className="content-stack">
      <input
        ref={additionalFileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleAdditionalPhotoChange}
        disabled={isProcessing}
        style={{ display: "none" }}
      />
      <section className="page-hero">
        <div>
          <h1>Plant Care Guide</h1>
          <p>Follow the guided steps to identify a plant and generate a personalised moisture policy.</p>
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

      <section className="card card--stepper">
        <div className="stepper-header">
          <div>
            <h3>Add a plant in three clear steps</h3>
            <p className="muted-text">Start with a photo, review the best match, then save the care guide.</p>
          </div>
          <div className="stepper-controls">
            {canStepBack && (
              <button type="button" className="secondary-button" onClick={handleStepBack} disabled={disableNavigation}>
                Back
              </button>
            )}
            <button type="button" className="tertiary-button" onClick={handleCancel} disabled={disableNavigation}>
              Cancel
            </button>
          </div>
        </div>
        <Stepper steps={STEP_DEFINITIONS} currentStep={currentStep} />
      </section>

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

      {showConfidence && confidence && (
        <div className="confidence-meter">
          <span className={`chip ${confidenceChipTone}`}>Confidence: {confidenceLabel}</span>
          <span className="muted-text">
            Top match {formatPercentage(confidence.topScore)} · Gap {formatPercentage(confidence.difference)}
          </span>
        </div>
      )}

      {showConfidenceNotice && (
        <div className="status-banner">
          <div>
            <strong>{isLowConfidence ? "Low identification confidence." : "Identification still uncertain."}</strong>{" "}
            {canAddMorePhotos
              ? isLowConfidence
                ? "Add another clear photo so we can compare more details."
                : "Add another angle or close-up to help confirm the match."
              : isLowConfidence
                ? "We still can't confirm the species from photos. Please enter it manually below."
                : "We're close, but not fully confident yet. Continue reviewing matches or enter the species manually."}
          </div>
          {nextPhotoHint && <p className="muted-text">{nextPhotoHint}</p>}
          <div className="button-row">
            {canAddMorePhotos && (
              <button
                type="button"
                className="secondary-button"
                onClick={triggerAdditionalPhotoPicker}
                disabled={isProcessing}
              >
                {isProcessing ? "Processing..." : `Add another photo (${additionalPhotosRemaining} left)`}
              </button>
            )}
            <button type="button" className="tertiary-button" onClick={handleEnableManualMode} disabled={isProcessing}>
              Use manual entry
            </button>
          </div>
        </div>
      )}

      {showManualRecommended && (
        <div className="error-banner">
          Confidence remained low after extra photos. Enter the species manually for the most accurate care guide.
        </div>
      )}

      {currentStep === "photo" && (
        <section className="card card--form">
          <div>
            <h3>Identify your plant</h3>
            <p className="muted-text">
              Upload a clear photo to identify likely species or switch to manual entry if you already know the name.
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
              {preparedImages.length > 0 && (
                <div className="prepared-photo-list">
                  {preparedImages.map((image, index) => (
                    <small key={`${index}-${image.file.lastModified}`} className="muted-text">
                      {describePreparedImage(image, index)}
                    </small>
                  ))}
                </div>
              )}
            </label>
          </div>

          <div className="button-row">
            <button
              className="primary-button"
              onClick={handleIdentify}
              disabled={isProcessing || preparedImages.length === 0 || !plantNetConfigured}
            >
              {isProcessing ? "Working..." : "Identify plant"}
            </button>
            <button className="secondary-button" type="button" onClick={handleManualToggle} disabled={isProcessing}>
              {manualMode ? "Hide manual entry" : "Enter species manually"}
            </button>
          </div>
        </section>
      )}

      {showManualEntryForm && (
        <ManualEntryForm
          draft={manualDraft}
          onChange={handleManualDraftChange}
          onSubmit={handleManualSubmit}
          disabled={isProcessing}
        />
      )}

      {showCandidates && (
        <CandidateList
          candidates={candidates}
          selectedKey={selectedKey}
          onSelect={handleSelectCandidate}
          disabled={isProcessing}
        />
      )}

      {currentStep === "candidates" && canViewSummary && (
        <div className="step-actions">
          <button type="button" className="primary-button" onClick={handleGoToSummary} disabled={disableNavigation}>
            Review care guide
          </button>
        </div>
      )}

      {showSummary && selectedCandidate && selectedProfile && (
        <PolicySummary candidate={selectedCandidate} profile={selectedProfile}>
          <div className="policy-summary__actions">
            {saveError && (
              <div className="error-banner error-banner--inline" role="alert">
                <div className="error-banner__message">{saveError}</div>
              </div>
            )}
            <div className="button-row">
              <button
                type="button"
                className="secondary-button"
                onClick={handleBackToCandidates}
                disabled={disableNavigation}
              >
                Choose another match
              </button>
              <button type="button" className="primary-button" onClick={handleAddPlant} disabled={!canAddPlant}>
                {addButtonLabel}
              </button>
            </div>
          </div>
        </PolicySummary>
      )}
    </div>
  );
};

export default AddPlantScreen;
