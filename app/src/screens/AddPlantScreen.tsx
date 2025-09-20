import { ChangeEvent, useState } from "react";
import type { IdentificationProvider } from "@services/id/provider";
import type { IdentificationCandidate } from "@services/id/types";
import type { ChatGptPolicyService } from "@services/policy/chatgpt";
import type { SpeciesProfile } from "@core/models/speciesProfile";
import type { PolicyGenerationRequest } from "@services/policy/chatgpt";

interface AddPlantScreenProps {
  identificationProvider: IdentificationProvider | null;
  policyService: ChatGptPolicyService | null;
  plantNetConfigured: boolean;
  openAiConfigured: boolean;
}

interface ResultState {
  candidate: IdentificationCandidate;
  profile: SpeciesProfile;
}

const ensureType = (candidate: IdentificationCandidate): PolicyGenerationRequest["type"] => {
  if (candidate.type && ["succulent", "semi-succulent", "tropical", "fern", "other"].includes(candidate.type)) {
    return candidate.type as PolicyGenerationRequest["type"];
  }
  return "other";
};

const formatPercentage = (value: number | undefined): string => {
  if (typeof value !== "number" || Number.isNaN(value)) return "N/A";
  return `${(value * 100).toFixed(1)}%`;
};

const AddPlantScreen = ({
  identificationProvider,
  policyService,
  plantNetConfigured,
  openAiConfigured,
}: AddPlantScreenProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [result, setResult] = useState<ResultState | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setResult(null);
    setStatus(undefined);
    setError(undefined);
  };

  const handleGenerate = async () => {
    if (!plantNetConfigured) {
      setError("PlantNet service is not configured. Ensure the dev server has PLANTNET_API_KEY set and restart.");
      return;
    }
    if (!openAiConfigured) {
      setError("OpenAI service is not configured. Ensure the dev server has OPENAI_API_KEY set and restart.");
      return;
    }
    if (!file) {
      setError("Choose a plant photo to continue.");
      return;
    }
    if (!identificationProvider || !policyService) {
      setError("Identification services are unavailable. Check API configuration.");
      return;
    }

    setIsProcessing(true);
    setStatus("Identifying species...");
    setError(undefined);

    console.info('[AddPlant] Starting generate', { plantNetConfigured, openAiConfigured, hasPolicy: Boolean(policyService) });
    try {
      const candidates = await identificationProvider.identify({
        images: [
          {
            data: file,
            filename: file.name,
            contentType: file.type,
          },
        ],
        limit: 3,
      });

      if (!candidates.length) {
        setError("No species candidates returned. Try another photo with clearer foliage.");
        setStatus(undefined);
        setIsProcessing(false);
        return;
      }

      const bestMatch = candidates[0];
      setStatus("Generating care guide...");

      const policyRequest: PolicyGenerationRequest = {
        speciesKey: bestMatch.speciesKey,
        canonicalName: bestMatch.canonicalName,
        commonName: bestMatch.commonName,
        confidence: bestMatch.score,
        type: ensureType(bestMatch),
      };

      const profile = await policyService.generate(policyRequest);
      setResult({ candidate: bestMatch, profile });
      setStatus("All set! Review the care guide below.");
    } catch (err) {
      setError((err as Error).message);
      setStatus(undefined);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="card">
      <h3>Plant Care Guide</h3>
      <p>Upload a plant photo and Smart Plant will identify it and fetch a tailored moisture policy.</p>

      <div className="form-grid" style={{ marginTop: "1rem" }}>
        <label>
          Plant photo
          <input type="file" accept="image/*" onChange={handleFileChange} />
        </label>

        <button className="primary-button" onClick={handleGenerate} disabled={isProcessing}>
          {isProcessing ? "Working..." : "Identify & Generate"}
        </button>

        {status && <div className="status-banner">{status}</div>}
        {error && <div className="error-banner">{error}</div>}

        {!plantNetConfigured && (
          <div className="error-banner">
            PlantNet service is not configured. Set <code>PLANTNET_API_KEY</code> in your environment and restart the dev server.
          </div>
        )}
        {!openAiConfigured && (
          <div className="error-banner">
            OpenAI service is not configured. Set <code>OPENAI_API_KEY</code> in your environment and restart the dev server.
          </div>
        )}

        {result && (
          <div className="card" style={{ marginTop: "1rem" }}>
            <h4>{result.candidate.canonicalName}</h4>
            {result.candidate.commonName && <p>Common name: {result.candidate.commonName}</p>}
            <p>Identification confidence: {formatPercentage(result.candidate.score)}</p>
            <p>Species key: {result.candidate.speciesKey}</p>

            <div style={{ marginTop: "1rem" }}>
              <h5>Moisture Policy</h5>
              <p>Water every <strong>{result.profile.moisturePolicy.waterIntervalDays}</strong> days.</p>
              <p>Soil moisture threshold: <strong>{result.profile.moisturePolicy.soilMoistureThreshold}%</strong>.</p>
              <p>Humidity preference: <strong>{result.profile.moisturePolicy.humidityPreference}</strong>.</p>
              <p>Light requirement: <strong>{result.profile.moisturePolicy.lightRequirement}</strong>.</p>
              {result.profile.moisturePolicy.notes.length > 0 && (
                <div>
                  <strong>Care notes:</strong>
                  <ul className="notes-list">
                    {result.profile.moisturePolicy.notes.map((note, index) => (
                      <li key={index}>{note}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddPlantScreen;





