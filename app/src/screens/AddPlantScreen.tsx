import ManualEntryForm from "@app/features/addPlant/components/ManualEntryForm";
import CandidateList from "@app/features/addPlant/components/CandidateList";
import PolicySummary from "@app/features/addPlant/components/PolicySummary";
import { useAddPlantFlow } from "@app/features/addPlant/hooks/useAddPlantFlow";
import { formatPercentage } from "@app/features/addPlant/utils";
import { usePlantCareServices } from "../providers/PlantCareProvider";

const AddPlantScreen = () => {
  const { plantNetConfigured, openAiConfigured, identify, resolvePolicy, manualCandidate } =
    usePlantCareServices();

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
            <input
              ref={additionalFileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAdditionalPhotoChange}
              disabled={isProcessing}
              style={{ display: "none" }}
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
          <button className="secondary-button" type="button" onClick={toggleManualMode} disabled={isProcessing}>
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

        {confidence && (
          <div className="confidence-meter">
            <span className={`chip ${confidenceChipTone}`}>Confidence: {confidenceLabel}</span>
            <span className="muted-text">
              Top match {formatPercentage(confidence.topScore)} · Gap {formatPercentage(confidence.difference)}
            </span>
          </div>
        )}

        {confidence?.level === "low" && (
          <div className="status-banner">
            <div>
              <strong>Low identification confidence.</strong>{" "}
              {canAddMorePhotos
                ? "Add another clear photo so we can compare more details."
                : "We still can't confirm the species from photos. Please enter it manually below."}
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
              <button type="button" className="tertiary-button" onClick={enableManualMode} disabled={isProcessing}>
                Use manual entry
              </button>
            </div>
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

      {manualRecommended && (
        <div className="error-banner">
          Confidence remained low after extra photos. Enter the species manually for the most accurate care guide.
        </div>
      )}

      {manualMode && (
        <ManualEntryForm
          draft={manualDraft}
          onChange={handleManualDraftChange}
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
