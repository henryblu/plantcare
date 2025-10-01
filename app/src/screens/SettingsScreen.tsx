import { useEffect, useMemo, useState } from "react";
import type { AppInfo } from "@config/appInfo";
import type { StorageFootprint } from "@core/state/store";

interface UiConfig {
  useMockPlantNet: boolean;
  useMockChatGpt: boolean;
  plantNetApiKey: string;
  openAiApiKey: string;
}

interface SettingsScreenProps {
  config: UiConfig;
  onChange: (config: UiConfig) => void;
  onClearAll: () => Promise<void> | void;
  onClearPlants: () => Promise<void> | void;
  onClearSpecies: () => Promise<void> | void;
  storageFootprint: StorageFootprint;
  appInfo: AppInfo;
}

type StatusKind = "success" | "error";

interface StatusMessage {
  kind: StatusKind;
  message: string;
}

type MaintenanceAction = "clear-plants" | "clear-species" | "clear-all";

const formatBytes = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"] as const;
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  if (unitIndex === 0) {
    return `${Math.round(size)} B`;
  }
  const decimals = size >= 100 ? 0 : size >= 10 ? 1 : 2;
  return `${size.toFixed(decimals)} ${units[unitIndex]}`;
};

const SettingsScreen = ({
  config,
  onChange,
  onClearAll,
  onClearPlants,
  onClearSpecies,
  storageFootprint,
  appInfo,
}: SettingsScreenProps) => {
  const [draft, setDraft] = useState<UiConfig>(config);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [pendingAction, setPendingAction] = useState<MaintenanceAction | null>(null);

  useEffect(() => {
    setDraft(config);
  }, [config]);

  const handleSave = () => {
    onChange(draft);
    setStatus({ kind: "success", message: "Settings saved." });
  };

  const runMaintenanceAction = async (
    action: () => Promise<void> | void,
    successMessage: string,
    failurePrefix: string,
    key: MaintenanceAction,
  ) => {
    setPendingAction(key);
    setStatus(null);
    try {
      await Promise.resolve(action());
      setStatus({ kind: "success", message: successMessage });
    } catch (error) {
      const message = (error as Error)?.message?.trim();
      setStatus({
        kind: "error",
        message: `${failurePrefix}${message ? `: ${message}` : "."}`,
      });
    } finally {
      setPendingAction(null);
    }
  };

  const handleClearPlants = () =>
    runMaintenanceAction(onClearPlants, "Plant list cleared.", "Failed to clear plant list", "clear-plants");

  const handleClearSpecies = () =>
    runMaintenanceAction(onClearSpecies, "Species cache cleared.", "Failed to clear species cache", "clear-species");

  const handleClearAll = () =>
    runMaintenanceAction(onClearAll, "All local data cleared.", "Failed to clear local data", "clear-all");

  const isBusy = pendingAction !== null;

  const { plantsBytes, speciesBytes, totalBytes } = storageFootprint;
  const usage = useMemo(
    () => ({
      plants: formatBytes(plantsBytes),
      species: formatBytes(speciesBytes),
      total: formatBytes(totalBytes),
    }),
    [plantsBytes, speciesBytes, totalBytes],
  );

  const applyDraft = (updater: (prev: UiConfig) => UiConfig) => {
    setStatus(null);
    setDraft((prev) => updater(prev));
  };

  return (
    <div className="card settings-card">
      <h3>Runtime configuration</h3>
      <div className="form-grid">
        <label>
          Mock PlantNet identification
          <select
            className="select-input"
            value={draft.useMockPlantNet ? "true" : "false"}
            onChange={(event) =>
              applyDraft((prev) => ({
                ...prev,
                useMockPlantNet: event.target.value === "true",
              }))
            }
            disabled={isBusy}
          >
            <option value="true">Yes (use canned candidates)</option>
            <option value="false">No (call PlantNet)</option>
          </select>
        </label>

        <label>
          Mock ChatGPT policies
          <select
            className="select-input"
            value={draft.useMockChatGpt ? "true" : "false"}
            onChange={(event) =>
              applyDraft((prev) => ({
                ...prev,
                useMockChatGpt: event.target.value === "true",
              }))
            }
            disabled={isBusy}
          >
            <option value="true">Yes (use seeded defaults)</option>
            <option value="false">No (call ChatGPT)</option>
          </select>
        </label>

        <label>
          PlantNet API key
          <input
            className="text-input"
            value={draft.plantNetApiKey}
            onChange={(event) =>
              applyDraft((prev) => ({
                ...prev,
                plantNetApiKey: event.target.value,
              }))
            }
            placeholder="plantnet_api_key"
            disabled={isBusy}
          />
        </label>

        <label>
          OpenAI API key
          <input
            className="text-input"
            value={draft.openAiApiKey}
            onChange={(event) =>
              applyDraft((prev) => ({
                ...prev,
                openAiApiKey: event.target.value,
              }))
            }
            placeholder="sk-..."
            disabled={isBusy}
          />
        </label>

        <div className="button-row">
          <button className="primary-button" type="button" onClick={handleSave} disabled={isBusy}>
            Save settings
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h4>Maintenance</h4>
        <p className="settings-description">Manage cached data stored on this device.</p>
        <div className="settings-actions">
          <button className="secondary-button" type="button" onClick={handleClearPlants} disabled={isBusy}>
            Clear plant list
          </button>
          <button className="secondary-button" type="button" onClick={handleClearSpecies} disabled={isBusy}>
            Clear species cache
          </button>
          <button className="danger-button" type="button" onClick={handleClearAll} disabled={isBusy}>
            Reset everything
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h4>Local storage usage</h4>
        <p className="settings-description">Values update automatically; sizes are approximate.</p>
        <dl className="settings-stats">
          <div>
            <dt>Plants</dt>
            <dd>{usage.plants}</dd>
          </div>
          <div>
            <dt>Species cache</dt>
            <dd>{usage.species}</dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd>{usage.total}</dd>
          </div>
        </dl>
      </div>

      <div className="settings-section">
        <h4>About this build</h4>
        <dl className="settings-stats">
          <div>
            <dt>Version</dt>
            <dd>{appInfo.version}</dd>
          </div>
          <div>
            <dt>Build mode</dt>
            <dd>{appInfo.buildMode}</dd>
          </div>
        </dl>
        <div className="settings-links">
          <a href={appInfo.readmeUrl} target="_blank" rel="noreferrer">
            View README
          </a>
          <a href={appInfo.helpUrl} target="_blank" rel="noreferrer">
            Operations guide
          </a>
        </div>
      </div>

      {status && (
        <div
          className={status.kind === "error" ? "error-banner" : "status-banner"}
          role="status"
          aria-live="polite"
        >
          {status.message}
        </div>
      )}
    </div>
  );
};

export default SettingsScreen;

