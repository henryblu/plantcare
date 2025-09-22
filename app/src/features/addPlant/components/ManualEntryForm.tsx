import { ChangeEvent, FormEvent } from "react";
import type { SpeciesType } from "@core/models/speciesProfile";
import { SPECIES_TYPE_OPTIONS } from "../utils";

export interface ManualEntryDraft {
  canonicalName: string;
  commonName: string;
  type: SpeciesType;
}

export interface ManualEntryFormProps {
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

export default ManualEntryForm;
