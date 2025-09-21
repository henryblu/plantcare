import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { SpeciesProfile, SpeciesType } from "@core/models/speciesProfile";
import type { IdentificationCandidate } from "@services/id/types";
import type { PolicyGenerationRequest } from "@services/policy/chatgpt";
import { ImageValidationError, prepareImageFile } from "@app/utils/imageProcessing";
import { PlantNetError } from "@services/id/plantNet";
import { usePlantCareServices } from "../providers/PlantCareProvider";

const SPECIES_TYPE_OPTIONS: SpeciesType[] = [
  "succulent",
  "semi-succulent",
  "tropical",
  "fern",
  "other",
];

const ensureType = (candidate: IdentificationCandidate): SpeciesType => {
  const candidateType = candidate.type?.toLowerCase();
  if (candidateType && SPECIES_TYPE_OPTIONS.includes(candidateType as SpeciesType)) {
    return candidateType as SpeciesType;
  }
  return "other";
};

const buildPolicyRequest = (candidate: IdentificationCandidate): PolicyGenerationRequest => ({
  speciesKey: candidate.speciesKey,
  canonicalName: candidate.canonicalName,
  commonName: candidate.commonName,
  confidence: candidate.score,
  type: ensureType(candidate),
});

const formatPercentage = (value: number | undefined): string => {
  if (typeof value !== "number" || Number.isNaN(value)) return "N/A";
  return `${(value * 100).toFixed(1)}%`;
};

interface ManualEntryDraft {
  canonicalName: string;
  commonName: string;
  type: SpeciesType;
}

interface ProcessedImageMeta {
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  wasDownscaled: boolean;
}


interface ManualEntryFormProps {
  draft: ManualEntryDraft;
  onChange: (next: ManualEntryDraft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  disabled: boolean;
}

const ManualEntryForm = ({ draft, onChange, onSubmit, disabled }: ManualEntryFormProps) => {
  const handleDraftChange = (key: keyof ManualEntryDraft) => (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    onChange({
      ...draft,
      [key]: key === "type" ? (event.target.value as SpeciesType) : event.target.value,
    });
  };

  const isSubmitDisabled = disabled || draft.canonicalName.trim().length === 0;

  return (
    <form className="card card--form" onSubmit={onSubmit}>
      <div>
        <h4>Manual species entry</h4>
        <p className="muted-text">
          Provide a canonical species name when PlantNet is unavailable or returns poor matches.
        </p>
      </div>
      <div className="form-grid split">
        <label>
          Canonical name
          <input
            type="text"
            value={draft.canonicalName}
            onChange={handleDraftChange("canonicalName")}
            placeholder="e.g. Dracaena trifasciata"
            disabled={disabled}
            required
          />
        </label>
        <label>
          Common name (optional)
          <input
            type="text"
            value={draft.commonName}
            onChange={handleDraftChange("commonName")}
            placeholder="Snake plant"
            disabled={disabled}
          />
        </label>
        <label>
          Species type
          <select value={draft.type} onChange={handleDraftChange("type")} disabled={disabled}>
            {SPECIES_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="button-row">
        <button className="secondary-button" type="submit" disabled={isSubmitDisabled}>
          Generate care guide
        </button>
      </div>
    </form>
  );
};

interface CandidateListProps {
  candidates: IdentificationCandidate[];
  selectedKey: string | null;
  onSelect: (speciesKey: string) => void;
  disabled: boolean;
}

const CandidateList = ({ candidates, selectedKey, onSelect, disabled }: CandidateListProps) => {
  if (!candidates.length) return null;

  return (
    <section className="card card--list">
      <div className="summary-header">
        <h4>Species candidates</h4>
        <p className="muted-text">Pick the closest match to refine the generated care guide.</p>
      </div>
      <div className="candidate-list">
        {candidates.map((candidate) => {
          const key = candidate.speciesKey;
          const isSelected = key === selectedKey;
          const className = `candidate-item${isSelected ? " candidate-item--active" : ""}`;
          return (
            <label key={key} className={className}>
              <div className="candidate-header">
                <input
                  type="radio"
                  name="speciesCandidate"
                  value={key}
                  checked={isSelected}
                  onChange={() => onSelect(key)}
                  disabled={disabled}
                />
                <div>
                  <strong>{candidate.canonicalName}</strong>
                  {candidate.commonName && <div className="candidate-subtitle">{candidate.commonName}</div>}
                </div>
              </div>
              <div className="candidate-meta">
                <span>Confidence: {formatPercentage(candidate.score)}</span>
                {candidate.source && <span>Source: {candidate.source}</span>}
              </div>
            </label>
          );
        })}
      </div>
    </section>
  );
};

interface PolicySummaryProps {
  candidate: IdentificationCandidate;
  profile: SpeciesProfile;
}

const PolicySummary = ({ candidate, profile }: PolicySummaryProps) => (
  <section className="card card--summary">
    <div className="summary-header">
      <h3>{candidate.canonicalName}</h3>
      {candidate.commonName && <span className="muted-text">Also known as {candidate.commonName}</span>}
    </div>

    <div className="badge-row">
      <span className="chip chip--outline">Confidence {formatPercentage(candidate.score)}</span>
      {candidate.source && <span className="chip chip--outline">Source {candidate.source}</span>}
      <span className="chip chip--outline">Species {candidate.speciesKey}</span>
    </div>

    <dl className="policy-grid">
      <div>
        <dt>Watering cadence</dt>
        <dd>
          Water every <strong>{profile.moisturePolicy.waterIntervalDays}</strong> days
        </dd>
      </div>
      <div>
        <dt>Moisture threshold</dt>
        <dd>
          Keep soil at <strong>{profile.moisturePolicy.soilMoistureThreshold}%</strong>
        </dd>
      </div>
      <div>
        <dt>Humidity preference</dt>
        <dd>{profile.moisturePolicy.humidityPreference}</dd>
      </div>
      <div>
        <dt>Light requirement</dt>
        <dd>{profile.moisturePolicy.lightRequirement}</dd>
      </div>
    </dl>

    {profile.moisturePolicy.notes.length > 0 && (
      <div className="notes-section">
        <strong>Care notes</strong>
        <ul className="notes-list">
          {profile.moisturePolicy.notes.map((note, index) => (
            <li key={index}>{note}</li>
          ))}
        </ul>
      </div>
    )}
  </section>
);

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
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualMode, setManualMode] = useState(!plantNetConfigured);
  const [manualDraft, setManualDraft] = useState<ManualEntryDraft>({
    canonicalName: "",
    commonName: "",
    type: "other",
  });

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

    setStatus("Processing image...");

    try {
      const prepared = await prepareImageFile(selected);
      if (fileProcessRef.current !== token) {
        return;
      }

      setFile(prepared.file);
      setImageMeta({
        width: prepared.width,
        height: prepared.height,
        originalWidth: prepared.originalWidth,
        originalHeight: prepared.originalHeight,
        wasDownscaled: prepared.wasDownscaled,
      });
      setStatus(
        prepared.wasDownscaled
          ? `Image optimized to ${prepared.width}x${prepared.height}px (down from ${prepared.originalWidth}x${prepared.originalHeight}px).`
          : `Image ready (${prepared.width}x${prepared.height}px).`,
      );
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
      setError(message);
      setFile(null);
      setImageMeta(null);
      event.target.value = "";
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
      setStatus("Loaded cached care guide.");
      return;
    }

    const runToken = startRun();
    try {
      setStatus(options?.forceRefresh ? "Refreshing care guide..." : "Generating care guide...");
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
      setStatus("All set! Review the care guide below.");
    } catch (err) {
      if (latestRunRef.current === runToken) {
        setStatus(null);
        setError((err as Error).message ?? "Failed to generate a care guide.");
      }
    } finally {
      finishRun(runToken);
    }
  };

  const handleIdentify = async () => {
    if (!plantNetConfigured) {
      setManualMode(true);
      setError("PlantNet service is not configured. Use manual entry instead.");
      return;
    }
    if (!file) {
      setError("Choose a prepared plant photo (JPEG/PNG/WEBP, at least 512x512) before identifying.");
      return;
    }

    resetResults();
    setStatus("Identifying species...");
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
        setError(message);
        setManualMode(true);
      }
      return;
    } finally {
      finishRun(runToken);
    }

    if (!results.length) {
      setStatus(null);
      setError("No species candidates returned. Try another photo or use manual entry.");
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
      setError((err as Error).message ?? "Manual entry failed.");
    }
  };

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

        {status && <div className="status-banner">{status}</div>}

        {error && <div className="error-banner">{error}</div>}
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
