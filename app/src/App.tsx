import { useMemo } from "react";
import { getRuntimeServicesConfig } from "@config/environment";
import { USE_MOCK_PLANTNET, USE_MOCK_CHATGPT } from "@config/featureFlags";
import {
  createIdentificationProvider,
  type IdentificationProvider,
} from "@services/id/provider";
import {
  PlantNetClient,
  type PlantNetClientOptions,
} from "@services/id/plantNet";
import {
  createChatGptPolicyService,
  getDefaultPolicySeeds,
  type ChatGptPolicyService,
} from "@services/policy/chatgpt";
import { PlantCareProvider } from "./providers/PlantCareProvider";
import AddPlantScreen from "./screens/AddPlantScreen";

const bindFetch = (): typeof fetch => {
  if (typeof window !== "undefined" && typeof window.fetch === "function") {
    return window.fetch.bind(window);
  }
  return fetch;
};

const App = () => {
  const runtimeConfig = useMemo(getRuntimeServicesConfig, []);
  const fetchFn = useMemo(bindFetch, []);
  const useMockPlantNet = USE_MOCK_PLANTNET;
  const useMockChatGpt = USE_MOCK_CHATGPT;

  const {
    plantNet: { configured: plantNetConfigured, endpoint: plantNetEndpoint },
    openAi: {
      configured: openAiBaseConfigured,
      endpoint: openAiEndpoint,
      apiKey: openAiApiKey,
    },
  } = runtimeConfig;

  const identificationProvider = useMemo<IdentificationProvider | null>(() => {
    if (useMockPlantNet) {
      return createIdentificationProvider({
        useMocks: true,
      });
    }

    if (!plantNetConfigured) {
      return null;
    }

    try {
      const options: PlantNetClientOptions = {
        fetchFn,
        defaultOrgans: ["leaf"],
        endpoint: plantNetEndpoint,
      };

      const client = new PlantNetClient(options);
      return createIdentificationProvider({
        useMocks: false,
        plantNetClient: client,
      });
    } catch (error) {
      console.error("[App] Failed to initialise PlantNet client", error);
      return null;
    }
  }, [useMockPlantNet, plantNetConfigured, plantNetEndpoint, fetchFn]);

  const policyService = useMemo<ChatGptPolicyService | null>(() => {
    try {
      return createChatGptPolicyService({
        apiKey: useMockChatGpt ? undefined : openAiApiKey,
        endpoint: openAiEndpoint,
        seedPolicies: getDefaultPolicySeeds(),
        fetchFn: useMockChatGpt ? undefined : fetchFn,
      });
    } catch (error) {
      console.error("[App] Failed to initialise ChatGPT policy service", error);
      return null;
    }
  }, [useMockChatGpt, openAiApiKey, openAiEndpoint, fetchFn]);

  const plantNetAvailable = (useMockPlantNet || plantNetConfigured) && Boolean(identificationProvider);
  const openAiReady = !useMockChatGpt && openAiBaseConfigured && Boolean(policyService);

  return (
    <PlantCareProvider
      identificationProvider={identificationProvider}
      policyService={policyService}
      plantNetConfigured={plantNetAvailable}
      openAiConfigured={openAiReady}
    >
      <div className="app-shell">
        <main className="app-content">
          <AddPlantScreen />
        </main>
      </div>
    </PlantCareProvider>
  );
};

export default App;
