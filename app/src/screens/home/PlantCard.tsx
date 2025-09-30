import {
  FormEvent,
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Plant } from "@core/models/plant";
import type { SpeciesProfile } from "@core/models/speciesProfile";
import { buildPlantPolicySummary, formatLastUpdated, selectPlantPolicy } from "./policySummary";
import type { EditPlantDetailsInput } from "../../features/home/usePlantActions";
import EditPlantModal from "./EditPlantModal";
import { useFocusTrap } from "../../hooks/useFocusTrap";

interface PlantCardProps {
  plant: Plant;
  profile?: SpeciesProfile;
  onRename?: (id: string, nickname: string | null) => void | Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
  onEdit?: (id: string, input: EditPlantDetailsInput) => void | Promise<void>;
}

const resolveDisplayNames = (plant: Plant, profile?: SpeciesProfile) => {
  const primary = plant.nickname || profile?.commonName || profile?.canonicalName || "Unnamed plant";
  const secondary = plant.nickname ? profile?.canonicalName ?? profile?.commonName : profile?.commonName;
  const tertiary = !plant.nickname && profile?.commonName ? profile.canonicalName : undefined;
  return { primary, secondary, tertiary };
};

const PlantCard = forwardRef<HTMLElement, PlantCardProps>(function PlantCard(
  { plant, profile, onRename, onDelete, onEdit }: PlantCardProps,
  forwardedRef,
) {
  const menuButtonId = useId();
  const confirmTitleId = useId();
  const confirmDescId = useId();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [nickname, setNickname] = useState(plant.nickname ?? "");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    setNickname(plant.nickname ?? "");
    setRenameError(null);
  }, [plant.nickname]);

  useEffect(() => {
    if (isRenaming) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [isRenaming]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickAway = (event: MouseEvent) => {
      if (menuRef.current && event.target instanceof Node && menuRef.current.contains(event.target)) {
        return;
      }
      setMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickAway);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickAway);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const handleToggleMenu = useCallback(() => {
    setMenuOpen((open) => !open);
  }, []);

  const handleStartRename = useCallback(() => {
    setMenuOpen(false);
    setRenameError(null);
    setIsRenaming(true);
  }, []);

  const handleRenameSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = nickname.trim();
      if (trimmed.length === 0) {
        setRenameError("Nickname needs at least one character.");
        renameInputRef.current?.focus();
        return;
      }
      if (!onRename) {
        setIsRenaming(false);
        return;
      }
      try {
        await onRename(plant.id, trimmed);
        setIsRenaming(false);
        setRenameError(null);
      } catch (error) {
        setRenameError((error as Error).message ?? "We couldn't rename this plant. Try again.");
        renameInputRef.current?.focus();
      }
    },
    [nickname, onRename, plant.id],
  );

  const handleRenameCancel = useCallback(() => {
    setNickname(plant.nickname ?? "");
    setRenameError(null);
    setIsRenaming(false);
  }, [plant.nickname]);

  const handleDeleteRequest = useCallback(() => {
    setMenuOpen(false);
    setConfirmOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (onDelete) {
      await onDelete(plant.id);
    }
    setConfirmOpen(false);
  }, [onDelete, plant.id]);

  const handleCancelDelete = useCallback(() => {
    setConfirmOpen(false);
  }, []);

  const handleStartEdit = useCallback(() => {
    setMenuOpen(false);
    setEditError(null);
    setEditOpen(true);
  }, []);

  const handleEditClose = useCallback(() => {
    setEditOpen(false);
  }, []);

  const handleEditSubmit = useCallback(
    async (input: EditPlantDetailsInput) => {
      if (!onEdit) {
        setEditOpen(false);
        return;
      }
      try {
        await onEdit(plant.id, input);
        setEditOpen(false);
        setEditError(null);
      } catch (error) {
        setEditError((error as Error).message ?? "We couldn't save those changes. Try again.");
      }
    },
    [onEdit, plant.id],
  );

  useEffect(() => {
    if (!confirmOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setConfirmOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [confirmOpen]);

  const policySummary = useMemo(() => buildPlantPolicySummary(plant, profile), [plant, profile]);
  const policy = useMemo(() => selectPlantPolicy(plant, profile), [plant, profile]);

  const { primary, secondary, tertiary } = useMemo(
    () => resolveDisplayNames(plant, profile),
    [plant, profile],
  );

  const lastUpdated = useMemo(
    () => formatLastUpdated(plant.updatedAt ?? profile?.updatedAt),
    [plant.updatedAt, profile?.updatedAt],
  );

  const photoAlt = plant.photoUri ? `${primary} plant photo` : `${primary} placeholder image`;

  const environmentLabel = useMemo(() => {
    if (!plant.environment || plant.environment === "unspecified") {
      return null;
    }
    return plant.environment === "indoor" ? "Indoor" : "Outdoor";
  }, [plant.environment]);

  return (
    <article
      className="card plant-card"
      aria-label={primary}
      tabIndex={0}
      role="listitem"
      ref={forwardedRef}
    >
      <div className="plant-card__media">
        {plant.photoUri ? (
          <img src={plant.photoUri} alt={photoAlt} className="plant-card__image" loading="lazy" />
        ) : (
          <div className="plant-card__placeholder" aria-hidden="true">
            <svg viewBox="0 0 80 80" role="presentation" focusable="false">
              <circle cx="40" cy="40" r="38" fill="rgba(126, 194, 148, 0.2)" />
              <path
                d="M42 16c-10 5-16 16-16 28s7 20 14 24c0-5-0.4-10 0.8-15 2.5-9 11-15 18-21 6-5 3-12-3-12-4 0-8 3-14 6z"
                fill="#42674e"
                opacity="0.82"
              />
              <path d="M32 49c6 4 12 4 18 0" stroke="#2f5c3a" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        )}
      </div>

      <div className="plant-card__body">
        <header className="plant-card__header">
          <div className="plant-card__names">
            <h4>{primary}</h4>
            {secondary && <span className="plant-card__subtitle muted-text">{secondary}</span>}
            {tertiary && <span className="plant-card__tertiary muted-text">{tertiary}</span>}
          </div>
          <div className="plant-card__actions">
            <button
              type="button"
              className="icon-button"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls={menuButtonId}
              onClick={handleToggleMenu}
            >
              <span className="sr-only">Plant actions</span>
              <svg viewBox="0 0 16 16" role="img" aria-hidden="true">
                <circle cx="2" cy="8" r="1.6" />
                <circle cx="8" cy="8" r="1.6" />
                <circle cx="14" cy="8" r="1.6" />
              </svg>
            </button>
            {menuOpen && (
              <div className="plant-card__menu" role="menu" id={menuButtonId} ref={menuRef}>
                <button type="button" role="menuitem" className="plant-card__menu-item" disabled>
                  View details (soon)
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="plant-card__menu-item"
                  onClick={handleStartRename}
                >
                  Rename
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="plant-card__menu-item"
                  onClick={handleStartEdit}
                >
                  Edit details
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="plant-card__menu-item plant-card__menu-item--danger"
                  onClick={handleDeleteRequest}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </header>

        {isRenaming ? (
          <form className="plant-card__rename" onSubmit={handleRenameSubmit}>
            <button type="button" className="icon-button plant-card__rename-close" aria-label="Cancel rename" onClick={handleRenameCancel}>
              <svg viewBox="0 0 16 16" role="img" aria-hidden="true">
                <path d="M4 4l8 8m0-8-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <label htmlFor={`rename-${plant.id}`} className="sr-only">
              Nickname
            </label>
            <input
              id={`rename-${plant.id}`}
              ref={renameInputRef}
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="Give this plant a nickname"
              aria-invalid={renameError ? "true" : undefined}
            />
            {renameError && (
              <p className="form-error" role="alert">
                {renameError}
              </p>
            )}
            <div className="plant-card__rename-actions">
              <button type="submit" className="primary-button primary-button--compact">
                Save
              </button>
              <button type="button" className="tertiary-button" onClick={handleRenameCancel}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <section className="plant-card__summary" aria-live="polite">
            {policySummary ? (
              <p>{policySummary}</p>
            ) : (
              <p className="muted-text">Policy unavailable. Generate a new guide from the Add Plant flow.</p>
            )}
            {environmentLabel && (
              <span className="chip chip--outline plant-card__environment-chip">{environmentLabel}</span>
            )}
            {policy?.notes && policy.notes.length > 0 && (
              <ul className="plant-card__notes">
                {policy.notes.map((note, index) => (
                  <li key={index}>{note}</li>
                ))}
              </ul>
            )}
            {plant.notes && (
              <div className="plant-card__personal-note">
                <strong>Your note</strong>
                <p>{plant.notes}</p>
              </div>
            )}
          </section>
        )}

        <footer className="plant-card__footer">
          <span className="muted-text">Last updated {lastUpdated}</span>
          {profile?.source && <span className="muted-text">Policy via {profile.source}</span>}
        </footer>
      </div>

      {confirmOpen && (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={confirmTitleId}
            aria-describedby={confirmDescId}
          >
            <button type="button" className="icon-button modal__close" aria-label="Cancel delete" onClick={handleCancelDelete}>
              <svg viewBox="0 0 16 16" role="img" aria-hidden="true">
                <path d="M4 4l8 8m0-8-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <h3 id={confirmTitleId}>Remove this plant?</h3>
            <p id={confirmDescId}>
              This removes <strong>{primary}</strong> from your saved list. The species profile stays cached for next time.
            </p>
            <div className="modal__actions">
              <button type="button" className="tertiary-button" onClick={handleCancelDelete}>
                Cancel delete
              </button>
              <button type="button" className="danger-button" onClick={handleConfirmDelete}>
                Delete plant
              </button>
            </div>
          </div>
        </div>
      )}
      {editOpen && (
        <EditPlantModal
          plant={plant}
          onClose={handleEditClose}
          onSubmit={handleEditSubmit}
          errorMessage={editError}
        />
      )}
    </article>
  );
});

export default PlantCard;
