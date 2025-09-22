import type { SpeciesProfile } from "@core/models/speciesProfile";
import type { IdentificationCandidate } from "@services/id/types";
import { formatPercentage } from "../utils";

export interface PolicySummaryProps {
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

export default PolicySummary;
