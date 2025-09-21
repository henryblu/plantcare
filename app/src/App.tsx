import { useMemo } from "react";
import { getRuntimeServicesConfig } from "@config/environment";
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
  ChatGptPolicyService,
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

  const {
    plantNet: { configured: plantNetConfigured, endpoint: plantNetEndpoint },
    openAi: {
      configured: openAiBaseConfigured,
      endpoint: openAiEndpoint,
      apiKey: openAiApiKey,
    },
  } = runtimeConfig;

  const identificationProvider = useMemo<IdentificationProvider | null>(() => {
    if (!plantNetConfigured) return null;
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
  }, [plantNetConfigured, plantNetEndpoint, fetchFn]);

  const policyService = useMemo<ChatGptPolicyService | null>(() => {
    try {
      return createChatGptPolicyService({
        apiKey: openAiApiKey,
        endpoint: openAiEndpoint,
        seedPolicies: getDefaultPolicySeeds(),
        fetchFn,
      });
    } catch (error) {
      console.error("[App] Failed to initialise ChatGPT policy service", error);
      return null;
    }
  }, [openAiApiKey, openAiEndpoint, fetchFn, openAiBaseConfigured]);

  const plantNetAvailable = plantNetConfigured && Boolean(identificationProvider);
  const openAiReady = openAiBaseConfigured && Boolean(policyService);

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
