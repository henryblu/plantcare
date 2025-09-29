import type { Plant } from "@core/models/plant";
import type { SpeciesProfile } from "@core/models/speciesProfile";

type HomeStatus = "loading" | "error" | "ready";

interface HomeScreenProps {
  plants: Plant[];
  speciesCache: Record<string, SpeciesProfile>;
  onAddPlant: () => void;
  status: HomeStatus;
  errorMessage?: string | null;
  onRetry?: () => void;
}

const formatDate = (value?: string) => {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const EmptyState = ({ onAddPlant, actionsDisabled }: Pick<HomeScreenProps, "onAddPlant"> & { actionsDisabled: boolean }) => (
  <div className="card card--empty">
    <div className="empty-state">
      <div className="empty-state__illustration" aria-hidden="true">
        <svg width="96" height="96" viewBox="0 0 96 96" role="presentation">
          <defs>
            <linearGradient id="leafGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2f5c3a" />
              <stop offset="50%" stopColor="#42674e" />
              <stop offset="100%" stopColor="#7ec294" />
            </linearGradient>
          </defs>
          <circle cx="48" cy="48" r="46" fill="rgba(126, 194, 148, 0.18)" />
          <path
            d="M49 18c-12 6-18 19-18 33 0 14 8 23 16 27 0-6-0.5-12 1-18 3-11 13-18 21-25C74 28 70 20 64 20c-5 0-10 3-15 8z"
            fill="url(#leafGradient)"
          />
          <path d="M38 52c6 4 12 4 18 0" stroke="#2f5c3a" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
      <h3>Grow your indoor garden</h3>
      <p className="muted-text">Add your first plant to see moisture guidance and personalised care policies.</p>
      <button
        className="primary-button"
        type="button"
        onClick={onAddPlant}
        disabled={actionsDisabled}
        aria-disabled={actionsDisabled}
      >
        Add your first plant
      </button>
    </div>
  </div>
);

const ErrorState = ({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) => (
  <div className="card card--empty">
    <div className="empty-state">
      <div className="empty-state__illustration" aria-hidden="true">
        <svg width="96" height="96" viewBox="0 0 96 96" role="presentation">
          <circle cx="48" cy="48" r="46" fill="rgba(251, 86, 7, 0.12)" />
          <path
            d="M48 25c-10 8-18 20-18 30 0 8 5 15 12 18 0-4-1-9 0-13 2-7 9-13 14-18 5-5 5-14-2-17-2-1-4-1-6 0z"
            fill="#fb5607"
            opacity="0.72"
          />
          <path d="M40 62h16" stroke="#fb5607" strokeWidth="4" strokeLinecap="round" />
        </svg>
      </div>
      <h3>We couldn't load your plants</h3>
      <p className="muted-text">{message}</p>
      {onRetry && (
        <button className="secondary-button" type="button" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  </div>
);

const HomeScreen = ({
  plants,
  speciesCache,
  onAddPlant,
  status,
  errorMessage,
  onRetry,
}: HomeScreenProps) => {
  const actionsDisabled = status !== "ready";

  if (status === "loading") {
    return (
      <div className="card card--list" aria-busy="true">
        <div className="home-list-header">
          <div className="skeleton skeleton--title" style={{ width: "220px" }} />
          <div className="skeleton skeleton--pill" style={{ width: "120px" }} />
        </div>
        <div className="list" aria-hidden="true">
          {Array.from({ length: 3 }, (_, index) => (
            <div className="card card--skeleton" key={index}>
              <div className="skeleton skeleton--title" />
              <div className="skeleton skeleton--text" />
              <div className="skeleton skeleton--text" />
              <div className="skeleton skeleton--text" style={{ width: "70%" }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (status === "error" && plants.length === 0) {
    return <ErrorState message={errorMessage ?? "Something went wrong."} onRetry={onRetry} />;
  }

  if (plants.length === 0) {
    return <EmptyState onAddPlant={onAddPlant} actionsDisabled={actionsDisabled} />;
  }

  return (
    <div className="card card--list">
      <div className="home-list-header">
        <div>
          <h3>Saved plants</h3>
          <p className="muted-text">Your personalised guidance stays on this device.</p>
        </div>
        <button
          className="secondary-button"
          type="button"
          onClick={onAddPlant}
          disabled={actionsDisabled}
          aria-disabled={actionsDisabled}
        >
          Add plant
        </button>
      </div>
      {status === "error" && (
        <div className="error-banner error-banner--inline" role="status">
          <div className="error-banner__message">
            {errorMessage ?? "We had trouble refreshing your saved plants. Showing the last known list."}
          </div>
          {onRetry && (
            <div className="error-banner__actions">
              <button type="button" className="tertiary-button" onClick={onRetry}>
                Retry load
              </button>
            </div>
          )}
        </div>
      )}
      <div className="list">
        {plants.map((plant) => {
          const profile = plant.speciesProfile ?? speciesCache[plant.speciesKey];
          return (
            <div className="card" key={plant.id}>
              <h3>{plant.nickname || profile?.commonName || profile?.canonicalName || "Unnamed Plant"}</h3>
              <p>
                <strong>Species:</strong> {profile?.canonicalName ?? plant.speciesKey}
              </p>
              {profile?.commonName && (
                <p>
                  <strong>Common:</strong> {profile.commonName}
                </p>
              )}
              {profile?.moisturePolicy && (
                <div>
                  <p>
                    <strong>Water every:</strong> {profile.moisturePolicy.waterIntervalDays} days
                  </p>
                  <p>
                    <strong>Soil threshold:</strong> {profile.moisturePolicy.soilMoistureThreshold}%
                  </p>
                  <p>
                    <strong>Humidity:</strong> {profile.moisturePolicy.humidityPreference}
                  </p>
                  <p>
                    <strong>Light:</strong> {profile.moisturePolicy.lightRequirement}
                  </p>
                  {profile.moisturePolicy.notes.length > 0 && (
                    <div>
                      <strong>Notes:</strong>
                      <ul className="notes-list">
                        {profile.moisturePolicy.notes.map((note, index) => (
                          <li key={index}>{note}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              <p>
                <strong>Last updated:</strong> {formatDate(plant.updatedAt)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HomeScreen;
