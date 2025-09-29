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

interface PlantCardProps {
  plant: Plant;
  profile?: SpeciesProfile;
  onRename?: (id: string, nickname: string | null) => void | Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
}

const resolveDisplayNames = (plant: Plant, profile?: SpeciesProfile) => {
  const primary = plant.nickname || profile?.commonName || profile?.canonicalName || "Unnamed plant";
  const secondary = plant.nickname ? profile?.canonicalName ?? profile?.commonName : profile?.commonName;
  const tertiary = !plant.nickname && profile?.commonName ? profile.canonicalName : undefined;
  return { primary, secondary, tertiary };
};

const PlantCard = forwardRef<HTMLElement, PlantCardProps>(function PlantCard(
  { plant, profile, onRename, onDelete }: PlantCardProps,
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

  useEffect(() => {
    setNickname(plant.nickname ?? "");
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
    setIsRenaming(true);
  }, []);

  const handleRenameSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!onRename) {
        setIsRenaming(false);
        return;
      }
      const trimmed = nickname.trim();
      await onRename(plant.id, trimmed.length ? trimmed : null);
      setIsRenaming(false);
    },
    [nickname, onRename, plant.id],
  );

  const handleRenameCancel = useCallback(() => {
    setNickname(plant.nickname ?? "");
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
            <label htmlFor={`rename-${plant.id}`} className="sr-only">
              Nickname
            </label>
            <input
              id={`rename-${plant.id}`}
              ref={renameInputRef}
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="Give this plant a nickname"
            />
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
            {policy?.notes && policy.notes.length > 0 && (
              <ul className="plant-card__notes">
                {policy.notes.map((note, index) => (
                  <li key={index}>{note}</li>
                ))}
              </ul>
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
            <h3 id={confirmTitleId}>Remove this plant?</h3>
            <p id={confirmDescId}>
              This removes <strong>{primary}</strong> from your saved list. The species profile stays cached for next time.
            </p>
            <div className="modal__actions">
              <button type="button" className="tertiary-button" onClick={handleCancelDelete}>
                Cancel
              </button>
              <button type="button" className="danger-button" onClick={handleConfirmDelete}>
                Delete plant
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
});

export default PlantCard;
