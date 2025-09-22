import type { SpeciesProfile } from "@core/models/speciesProfile";
import type { IdentificationCandidate } from "@services/id/types";
import { formatPercentage } from "../utils";

export interface PolicySummaryProps {
  candidate: IdentificationCandidate;
  profile: SpeciesProfile;
}

const formatLightLabel = (value: string): string => value.replace(/-/g, " ");

const describeCadence = (days: number): string => {
  if (days <= 0) {
    return "Water when soil feels dry";
  }
  if (days === 1) {
    return "Water daily";
  }
  if (days === 2) {
    return "Water every other day";
  }
  return `Water every ${days} days`;
};

const describeThreshold = (threshold: number): string =>
  threshold > 0 ? ` when soil < ${threshold}%` : " when soil is dry";

const describeHumidity = (value: string): string => {
  if (value === "medium") {
    return "";
  }
  return ` and ${value} humidity`;
};

const buildOneLineSummary = (profile: SpeciesProfile): string => {
  const { moisturePolicy } = profile;
  const cadence = describeCadence(moisturePolicy.waterIntervalDays);
  const threshold = describeThreshold(moisturePolicy.soilMoistureThreshold);
  const light = formatLightLabel(moisturePolicy.lightRequirement);
  const humidity = describeHumidity(moisturePolicy.humidityPreference);

  return `${cadence}${threshold}; prefers ${light} light${humidity}.`;
};

const PolicySummary = ({ candidate, profile }: PolicySummaryProps) => {
  const summaryLine = buildOneLineSummary(profile);
  const { moisturePolicy } = profile;
  const notes = moisturePolicy.notes ?? [];

  return (
    <section className="card card--summary">
      <div className="summary-header">
        <h3>{candidate.canonicalName}</h3>
        {candidate.commonName && <span className="muted-text">Also known as {candidate.commonName}</span>}
      </div>

      <div className="summary-status">
        <span className="chip chip--success">Care guide ready</span>
        <p className="policy-summary__lead">{summaryLine}</p>
      </div>

      <div className="badge-row">
        <span className="chip chip--outline">Confidence {formatPercentage(candidate.score)}</span>
        {candidate.source && <span className="chip chip--outline">Source {candidate.source}</span>}
        <span className="chip chip--outline">Species {candidate.speciesKey}</span>
        <span className="chip chip--outline">Policy via {profile.source}</span>
      </div>

      <dl className="policy-grid">
        <div>
          <dt>Watering cadence</dt>
          <dd>
            Water every <strong>{moisturePolicy.waterIntervalDays}</strong> days
          </dd>
        </div>
        <div>
          <dt>Moisture threshold</dt>
          <dd>
            Keep soil at <strong>{moisturePolicy.soilMoistureThreshold}%</strong>
          </dd>
        </div>
        <div>
          <dt>Humidity preference</dt>
          <dd>{moisturePolicy.humidityPreference}</dd>
        </div>
        <div>
          <dt>Light requirement</dt>
          <dd>{formatLightLabel(moisturePolicy.lightRequirement)}</dd>
        </div>
      </dl>

      {notes.length > 0 && (
        <div className="notes-section">
          <strong>Care notes</strong>
          <ul className="notes-list">
            {notes.map((note, index) => (
              <li key={index}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

export default PolicySummary;
