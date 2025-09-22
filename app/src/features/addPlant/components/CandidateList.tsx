import type { IdentificationCandidate } from "@services/id/types";
import { formatPercentage } from "../utils";

export interface CandidateListProps {
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

export default CandidateList;
