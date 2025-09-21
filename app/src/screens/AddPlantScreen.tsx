import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { SpeciesProfile, SpeciesType } from "@core/models/speciesProfile";
import type { IdentificationCandidate } from "@services/id/types";
import type { PolicyGenerationRequest } from "@services/policy/chatgpt";
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
    <form className="card" style={{ marginTop: "1rem" }} onSubmit={onSubmit}>
      <h4>Manual species entry</h4>
      <p>Provide a canonical species name when PlantNet is unavailable or returns poor matches.</p>
      <div className="form-grid" style={{ marginTop: "1rem" }}>
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
      <div className="button-row" style={{ marginTop: "1rem" }}>
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
    <div className="card" style={{ marginTop: "1rem" }}>
      <h4>Species candidates</h4>
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
                <span>Source: {candidate.source}</span>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
};

interface PolicySummaryProps {
  candidate: IdentificationCandidate;
  profile: SpeciesProfile;
}

const PolicySummary = ({ candidate, profile }: PolicySummaryProps) => (
  <div className="card" style={{ marginTop: "1rem" }}>
    <h4>{candidate.canonicalName}</h4>
    {candidate.commonName && <p>Common name: {candidate.commonName}</p>}
    <p>Identification confidence: {formatPercentage(candidate.score)}</p>
    <p>Species key: {candidate.speciesKey}</p>

    <div style={{ marginTop: "1rem" }}>
      <h5>Moisture Policy</h5>
      <p>
        Water every <strong>{profile.moisturePolicy.waterIntervalDays}</strong> days.
      </p>
      <p>
        Soil moisture threshold: <strong>{profile.moisturePolicy.soilMoistureThreshold}%</strong>.
      </p>
      <p>
        Humidity preference: <strong>{profile.moisturePolicy.humidityPreference}</strong>.
      </p>
      <p>
        Light requirement: <strong>{profile.moisturePolicy.lightRequirement}</strong>.
      </p>
      {profile.moisturePolicy.notes.length > 0 && (
        <div>
          <strong>Care notes:</strong>
          <ul className="notes-list">
            {profile.moisturePolicy.notes.map((note, index) => (
              <li key={index}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  </div>
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

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    resetResults();
    setManualMode(false);
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
      setError("Choose a plant photo to continue.");
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
        setError((err as Error).message ?? "Failed to identify species. Try manual entry.");
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
    <div className="card">
      <h3>Plant Care Guide</h3>
      <p>Upload a plant photo or enter the species manually to generate a tailored moisture policy.</p>

      <div className="form-grid" style={{ marginTop: "1rem" }}>
        <label>
          Plant photo
          <input type="file" accept="image/*" onChange={handleFileChange} disabled={isProcessing} />
        </label>
      </div>

      <div className="button-row" style={{ marginTop: "1rem" }}>
        <button className="primary-button" onClick={handleIdentify} disabled={isProcessing || !file || !plantNetConfigured}>
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
        <div className="error-banner" style={{ marginTop: "1rem" }}>
          PlantNet service is not configured. Set <code>PLANTNET_API_KEY</code> and restart the dev server, or use manual entry below.
        </div>
      )}

      {!openAiConfigured && (
        <div className="status-banner" style={{ marginTop: "1rem" }}>
          Policy service fallback in use. Seeded defaults will be applied when ChatGPT is unavailable.
        </div>
      )}

      {status && (
        <div className="status-banner" style={{ marginTop: "1rem" }}>
          {status}
        </div>
      )}

      {error && (
        <div className="error-banner" style={{ marginTop: "1rem" }}>
          {error}
        </div>
      )}

      {manualMode && (
        <ManualEntryForm draft={manualDraft} onChange={setManualDraft} onSubmit={handleManualSubmit} disabled={isProcessing} />
      )}

      <CandidateList
        candidates={candidates}
        selectedKey={selectedKey}
        onSelect={handleSelectCandidate}
        disabled={isProcessing}
      />

      {selectedCandidate && selectedProfile && <PolicySummary candidate={selectedCandidate} profile={selectedProfile} />}
    </div>
  );
};

export default AddPlantScreen;
