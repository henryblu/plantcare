import { jsx as _jsx } from "react/jsx-runtime";
import { useMemo } from "react";
import { createIdentificationProvider, } from "@services/id/provider";
import { PlantNetClient, } from "@services/id/plantNet";
import { createChatGptPolicyService, getDefaultPolicySeeds, } from "@services/policy/chatgpt";
import AddPlantScreen from "./screens/AddPlantScreen";
const readEnv = (key) => {
    const fromMeta = typeof import.meta !== "undefined" ? import.meta.env?.[key] : undefined;
    if (typeof fromMeta === "string" && fromMeta.length > 0) {
        return fromMeta;
    }
    if (typeof process !== "undefined" && process.env && typeof process.env[key] === "string") {
        return process.env[key];
    }
    return "";
};
const bindFetch = () => {
    if (typeof window !== "undefined" && typeof window.fetch === "function") {
        return window.fetch.bind(window);
    }
    return fetch;
};
const App = () => {
    const plantNetEndpointSetting = readEnv("VITE_PLANTNET_ENDPOINT").trim();
    const defaultPlantNetEndpoint = "/api/plantnet/identify";
    const plantNetEndpoint = plantNetEndpointSetting || defaultPlantNetEndpoint;
    const plantNetConfigured = plantNetEndpoint.startsWith("/") || plantNetEndpointSetting.length > 0;
    const openAiApiKeyCandidate = readEnv("VITE_OPENAI_API_KEY").trim();
    const openAiEndpointSetting = readEnv("VITE_OPENAI_ENDPOINT").trim();
    const openAiEndpoint = openAiEndpointSetting || "/api/openai/policy";
    const openAiUsesProxy = openAiEndpoint.startsWith("/");
    const openAiApiKey = openAiUsesProxy ? "" : openAiApiKeyCandidate;
    const openAiBaseConfigured = openAiUsesProxy || openAiEndpointSetting.length > 0 || openAiApiKey.length > 0;
    console.info('[App] OpenAI endpoint', openAiEndpoint);
    console.info('[App] OpenAI uses proxy', openAiUsesProxy);
    const fetchFn = useMemo(bindFetch, []);
    const identificationProvider = useMemo(() => {
        if (!plantNetConfigured)
            return null;
        try {
            const options = {
                fetchFn,
                defaultOrgans: ["leaf"],
            };
            if (plantNetEndpoint) {
                options.endpoint = plantNetEndpoint;
            }
            const client = new PlantNetClient(options);
            return createIdentificationProvider({
                useMocks: false,
                plantNetClient: client,
            });
        }
        catch (error) {
            console.error("Failed to initialise PlantNet client", error);
            return null;
        }
    }, [plantNetConfigured, plantNetEndpoint, fetchFn]);
    const policyService = useMemo(() => {
        if (!openAiBaseConfigured)
            return null;
        try {
            return createChatGptPolicyService({
                apiKey: openAiApiKey || undefined,
                endpoint: openAiEndpoint,
                seedPolicies: getDefaultPolicySeeds(),
                fetchFn,
            });
        }
        catch (error) {
            console.error("Failed to initialise ChatGPT policy service", error);
            return null;
        }
    }, [openAiBaseConfigured, openAiApiKey, openAiEndpoint, fetchFn]);
    const openAiConfigured = Boolean(policyService);
    return (_jsx("div", { className: "app-shell", children: _jsx("main", { className: "app-content", children: _jsx(AddPlantScreen, { identificationProvider: identificationProvider, policyService: policyService, plantNetConfigured: plantNetConfigured, openAiConfigured: openAiConfigured }) }) }));
};
export default App;
