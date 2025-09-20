import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
const SettingsScreen = ({ config, onChange, onClearData }) => {
    const [draft, setDraft] = useState(config);
    const [status, setStatus] = useState();
    const handleSave = () => {
        onChange(draft);
        setStatus("Settings saved.");
    };
    const handleClear = async () => {
        await onClearData();
        setStatus("Local store cleared.");
    };
    return (_jsxs("div", { className: "card", children: [_jsx("h3", { children: "Settings" }), _jsxs("div", { className: "form-grid", children: [_jsxs("label", { children: ["Use mock services", _jsxs("select", { className: "select-input", value: draft.useMocks ? "true" : "false", onChange: (event) => setDraft((prev) => ({
                                    ...prev,
                                    useMocks: event.target.value === "true",
                                })), children: [_jsx("option", { value: "true", children: "Yes (offline demo)" }), _jsx("option", { value: "false", children: "No (call live services)" })] })] }), _jsxs("label", { children: ["PlantNet API key", _jsx("input", { className: "text-input", value: draft.plantNetApiKey, onChange: (event) => setDraft((prev) => ({
                                    ...prev,
                                    plantNetApiKey: event.target.value,
                                })), placeholder: "plantnet_api_key" })] }), _jsxs("label", { children: ["OpenAI API key", _jsx("input", { className: "text-input", value: draft.openAiApiKey, onChange: (event) => setDraft((prev) => ({
                                    ...prev,
                                    openAiApiKey: event.target.value,
                                })), placeholder: "sk-..." })] }), _jsxs("div", { className: "button-row", children: [_jsx("button", { className: "primary-button", onClick: handleSave, children: "Save settings" }), _jsx("button", { className: "secondary-button", onClick: handleClear, children: "Clear local data" })] }), status && _jsx("div", { className: "status-banner", children: status })] })] }));
};
export default SettingsScreen;
