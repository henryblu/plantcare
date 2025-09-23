import { useState } from "react";

interface UiConfig {
  useMockPlantNet: boolean;
  useMockChatGpt: boolean;
  plantNetApiKey: string;
  openAiApiKey: string;
}

interface SettingsScreenProps {
  config: UiConfig;
  onChange: (config: UiConfig) => void;
  onClearData: () => Promise<void> | void;
}

const SettingsScreen = ({ config, onChange, onClearData }: SettingsScreenProps) => {
  const [draft, setDraft] = useState<UiConfig>(config);
  const [status, setStatus] = useState<string | undefined>();

  const handleSave = () => {
    onChange(draft);
    setStatus("Settings saved.");
  };

  const handleClear = async () => {
    await onClearData();
    setStatus("Local store cleared.");
  };

  return (
    <div className="card">
      <h3>Settings</h3>
      <div className="form-grid">
        <label>
          Mock PlantNet identification
          <select
            className="select-input"
            value={draft.useMockPlantNet ? "true" : "false"}
            onChange={(event) =>
              setDraft((prev: UiConfig) => ({
                ...prev,
                useMockPlantNet: event.target.value === "true",
              }))
            }
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
              setDraft((prev: UiConfig) => ({
                ...prev,
                useMockChatGpt: event.target.value === "true",
              }))
            }
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
              setDraft((prev: UiConfig) => ({
                ...prev,
                plantNetApiKey: event.target.value,
              }))
            }
            placeholder="plantnet_api_key"
          />
        </label>

        <label>
          OpenAI API key
          <input
            className="text-input"
            value={draft.openAiApiKey}
            onChange={(event) =>
              setDraft((prev: UiConfig) => ({
                ...prev,
                openAiApiKey: event.target.value,
              }))
            }
            placeholder="sk-..."
          />
        </label>

        <div className="button-row">
          <button className="primary-button" onClick={handleSave}>
            Save settings
          </button>
          <button className="secondary-button" onClick={handleClear}>
            Clear local data
          </button>
        </div>

        {status && <div className="status-banner">{status}</div>}
      </div>
    </div>
  );
};

export default SettingsScreen;
