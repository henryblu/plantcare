import type { Plant } from "@core/models/plant";
import type { SpeciesProfile } from "@core/models/speciesProfile";

interface HomeScreenProps {
  plants: Plant[];
  speciesCache: Record<string, SpeciesProfile>;
  onAddPlant: () => void;
}

const formatDate = (value?: string) => {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const HomeScreen = ({ plants, speciesCache, onAddPlant }: HomeScreenProps) => {
  if (plants.length === 0) {
    return (
      <div className="card">
        <h3>No plants yet</h3>
        <p>Add your first plant to see moisture guidance and care policies.</p>
        <button className="primary-button" type="button" onClick={onAddPlant}>
          Add a plant
        </button>
      </div>
    );
  }

  return (
    <div className="card card--list">
      <div className="home-list-header">
        <div>
          <h3>Saved plants</h3>
          <p className="muted-text">Your personalised guidance stays on this device.</p>
        </div>
        <button className="secondary-button" type="button" onClick={onAddPlant}>
          Add plant
        </button>
      </div>
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
