import { FormEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { Plant, PlantEnvironment } from "@core/models/plant";
import { PLANT_ENVIRONMENTS } from "@core/models/plant";
import type { EditPlantDetailsInput } from "../../features/home/usePlantActions";

const MAX_NOTE_LENGTH = 160;

const ENVIRONMENT_OPTIONS: Array<{ value: PlantEnvironment | "unspecified"; label: string }> = [
  { value: "unspecified", label: "Unspecified" },
  { value: "indoor", label: "Indoor" },
  { value: "outdoor", label: "Outdoor" },
];

interface EditPlantModalProps {
  plant: Plant;
  onClose: () => void;
  onSubmit: (input: EditPlantDetailsInput) => Promise<void>;
  errorMessage?: string | null;
}

const EditPlantModal = ({ plant, onClose, onSubmit, errorMessage }: EditPlantModalProps) => {
  const titleId = useId();
  const descriptionId = useId();
  const environmentId = useId();
  const notesId = useId();
  const checkboxId = useId();
  const environmentRef = useRef<HTMLSelectElement | null>(null);

  const initialEnvironment = useMemo<PlantEnvironment | "unspecified">(() => {
    if (!plant.environment) return "unspecified";
    return PLANT_ENVIRONMENTS.includes(plant.environment) ? plant.environment : "unspecified";
  }, [plant.environment]);

  const [environment, setEnvironment] = useState<PlantEnvironment | "unspecified">(initialEnvironment);
  const [notes, setNotes] = useState(plant.notes ?? "");
  const [forcePolicyRefresh, setForcePolicyRefresh] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    environmentRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setValidationError(null);
      const trimmedNotes = notes.trim();
      if (trimmedNotes.length > MAX_NOTE_LENGTH) {
        setValidationError(`Notes must be ${MAX_NOTE_LENGTH} characters or fewer.`);
        return;
      }
      try {
        await onSubmit({
          environment,
          notes: trimmedNotes,
          forcePolicyRefresh,
        });
      } catch {
        // Parent component surfaces errorMessage; no further action needed here.
      }
    },
    [environment, forcePolicyRefresh, notes, onSubmit],
  );

  const characterCount = `${notes.length}/${MAX_NOTE_LENGTH}`;

  return (
    <div className="modal-backdrop" role="presentation">
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onSubmit={handleSubmit}
      >
        <h3 id={titleId}>Edit plant details</h3>
        <p id={descriptionId} className="muted-text">
          Update where this plant lives, jot personal notes, or force a fresh care policy.
        </p>

        <div className="form-field">
          <label htmlFor={environmentId}>Plant type</label>
          <select
            id={environmentId}
            ref={environmentRef}
            value={environment}
            onChange={(event) => setEnvironment(event.target.value as PlantEnvironment | "unspecified")}
          >
            {ENVIRONMENT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor={notesId}>Custom notes</label>
          <textarea
            id={notesId}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
          />
          <div className="muted-text form-helper">{characterCount}</div>
          {validationError && (
            <p className="form-error" role="alert">
              {validationError}
            </p>
          )}
        </div>

        <div className="form-field form-field--checkbox">
          <input
            id={checkboxId}
            type="checkbox"
            checked={forcePolicyRefresh}
            onChange={(event) => setForcePolicyRefresh(event.target.checked)}
          />
          <label htmlFor={checkboxId}>Refresh moisture policy from ChatGPT</label>
        </div>

        {errorMessage && (
          <div className="error-banner" role="alert">
            <div className="error-banner__message">{errorMessage}</div>
          </div>
        )}

        <div className="modal__actions">
          <button type="button" className="tertiary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-button">
            Save changes
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditPlantModal;
