import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
const ensureType = (candidate) => {
    if (candidate.type && ["succulent", "semi-succulent", "tropical", "fern", "other"].includes(candidate.type)) {
        return candidate.type;
    }
    return "other";
};
const formatPercentage = (value) => {
    if (typeof value !== "number" || Number.isNaN(value))
        return "N/A";
    return `${(value * 100).toFixed(1)}%`;
};
const AddPlantScreen = ({ identificationProvider, policyService, plantNetConfigured, openAiConfigured, }) => {
    const [file, setFile] = useState(null);
    const [status, setStatus] = useState();
    const [error, setError] = useState();
    const [result, setResult] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const handleFileChange = (event) => {
        const selected = event.target.files?.[0] ?? null;
        setFile(selected);
        setResult(null);
        setStatus(undefined);
        setError(undefined);
    };
    const handleGenerate = async () => {
        if (!plantNetConfigured) {
            setError("PlantNet service is not configured. Ensure the dev server has PLANTNET_API_KEY set and restart.");
            return;
        }
        if (!openAiConfigured) {
            setError("OpenAI service is not configured. Ensure the dev server has OPENAI_API_KEY set and restart.");
            return;
        }
        if (!file) {
            setError("Choose a plant photo to continue.");
            return;
        }
        if (!identificationProvider || !policyService) {
            setError("Identification services are unavailable. Check API configuration.");
            return;
        }
        setIsProcessing(true);
        setStatus("Identifying species...");
        setError(undefined);
        console.info('[AddPlant] Starting generate', { plantNetConfigured, openAiConfigured, hasPolicy: Boolean(policyService) });
        try {
            const candidates = await identificationProvider.identify({
                images: [
                    {
                        data: file,
                        filename: file.name,
                        contentType: file.type,
                    },
                ],
                limit: 3,
            });
            if (!candidates.length) {
                setError("No species candidates returned. Try another photo with clearer foliage.");
                setStatus(undefined);
                setIsProcessing(false);
                return;
            }
            const bestMatch = candidates[0];
            setStatus("Generating care guide...");
            const policyRequest = {
                speciesKey: bestMatch.speciesKey,
                canonicalName: bestMatch.canonicalName,
                commonName: bestMatch.commonName,
                confidence: bestMatch.score,
                type: ensureType(bestMatch),
            };
            const profile = await policyService.generate(policyRequest);
            setResult({ candidate: bestMatch, profile });
            setStatus("All set! Review the care guide below.");
        }
        catch (err) {
            setError(err.message);
            setStatus(undefined);
        }
        finally {
            setIsProcessing(false);
        }
    };
    return (_jsxs("div", { className: "card", children: [_jsx("h3", { children: "Plant Care Guide" }), _jsx("p", { children: "Upload a plant photo and Smart Plant will identify it and fetch a tailored moisture policy." }), _jsxs("div", { className: "form-grid", style: { marginTop: "1rem" }, children: [_jsxs("label", { children: ["Plant photo", _jsx("input", { type: "file", accept: "image/*", onChange: handleFileChange })] }), _jsx("button", { className: "primary-button", onClick: handleGenerate, disabled: isProcessing, children: isProcessing ? "Working..." : "Identify & Generate" }), status && _jsx("div", { className: "status-banner", children: status }), error && _jsx("div", { className: "error-banner", children: error }), !plantNetConfigured && (_jsxs("div", { className: "error-banner", children: ["PlantNet service is not configured. Set ", _jsx("code", { children: "PLANTNET_API_KEY" }), " in your environment and restart the dev server."] })), !openAiConfigured && (_jsxs("div", { className: "error-banner", children: ["OpenAI service is not configured. Set ", _jsx("code", { children: "OPENAI_API_KEY" }), " in your environment and restart the dev server."] })), result && (_jsxs("div", { className: "card", style: { marginTop: "1rem" }, children: [_jsx("h4", { children: result.candidate.canonicalName }), result.candidate.commonName && _jsxs("p", { children: ["Common name: ", result.candidate.commonName] }), _jsxs("p", { children: ["Identification confidence: ", formatPercentage(result.candidate.score)] }), _jsxs("p", { children: ["Species key: ", result.candidate.speciesKey] }), _jsxs("div", { style: { marginTop: "1rem" }, children: [_jsx("h5", { children: "Moisture Policy" }), _jsxs("p", { children: ["Water every ", _jsx("strong", { children: result.profile.moisturePolicy.waterIntervalDays }), " days."] }), _jsxs("p", { children: ["Soil moisture threshold: ", _jsxs("strong", { children: [result.profile.moisturePolicy.soilMoistureThreshold, "%"] }), "."] }), _jsxs("p", { children: ["Humidity preference: ", _jsx("strong", { children: result.profile.moisturePolicy.humidityPreference }), "."] }), _jsxs("p", { children: ["Light requirement: ", _jsx("strong", { children: result.profile.moisturePolicy.lightRequirement }), "."] }), result.profile.moisturePolicy.notes.length > 0 && (_jsxs("div", { children: [_jsx("strong", { children: "Care notes:" }), _jsx("ul", { className: "notes-list", children: result.profile.moisturePolicy.notes.map((note, index) => (_jsx("li", { children: note }, index))) })] }))] })] }))] })] }));
};
export default AddPlantScreen;
