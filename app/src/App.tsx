import { useCallback, useEffect, useMemo, useState } from "react";
import { getRuntimeServicesConfig } from "@config/environment";
import { USE_MOCK_PLANTNET, USE_MOCK_CHATGPT } from "@config/featureFlags";
import { getAppInfo } from "@config/appInfo";
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
import {
  PlantCareProvider,
  usePlantCareServices,
  usePlantStoreSnapshot,
} from "./providers/PlantCareProvider";
import AddPlantScreen from "./screens/AddPlantScreen";
import HomeScreen from "./screens/HomeScreen";
import SettingsScreen from "./screens/SettingsScreen";
import TabNavigation from "./components/TabNavigation";
import { useNavigation } from "./navigation/router";
import {
  ADD_ROUTE_STEPS,
  DEFAULT_ADD_STEP,
  isValidAddStep,
  type AddRouteStep,
} from "./features/addPlant/constants";
import {
  usePlantActions,
  type EditPlantDetailsInput,
} from "./features/home/usePlantActions";
import Toast from "./components/Toast";

const bindFetch = (): typeof fetch => {
  if (typeof window !== "undefined" && typeof window.fetch === "function") {
    return window.fetch.bind(window);
  }
  return fetch;
};

type UiConfig = {
  useMockPlantNet: boolean;
  useMockChatGpt: boolean;
  plantNetApiKey: string;
  openAiApiKey: string;
};

type AppShellProps = {
  initialConfig: UiConfig;
};

const AppShell = ({ initialConfig }: AppShellProps) => {
  const { location, navigate, buildPath } = useNavigation();
  const {
    hydrated,
    hydrateError,
    reloadStore,
    clearStore,
    clearPlants,
    clearSpeciesCache,
    plantNetConfigured,
    openAiConfigured,
    store,
    resolvePolicy,
    getStorageFootprint,
  } = usePlantCareServices();
  const { plants, speciesProfiles } = usePlantStoreSnapshot();
  const [uiConfig, setUiConfig] = useState<UiConfig>(initialConfig);

  const homeStatus: "loading" | "error" | "ready" = !hydrated
    ? "loading"
    : hydrateError
      ? "error"
      : "ready";
  const canNavigateToAddPlant = homeStatus === "ready";

  useEffect(() => {
    if (location.route !== "add") return;
    const params = new URLSearchParams(location.search);
    if (isValidAddStep(params.get("step"))) {
      return;
    }
    params.set("step", DEFAULT_ADD_STEP);
    navigate(buildPath("/add", params.toString()), { replace: true });
  }, [buildPath, location.route, location.search, navigate]);

  const handleAddPlant = useCallback(() => {
    if (!canNavigateToAddPlant) {
      return;
    }
    navigate(buildPath("/add", "step=photo"));
  }, [buildPath, navigate, canNavigateToAddPlant]);

  const handleConfigChange = useCallback((next: UiConfig) => {
    setUiConfig(next);
  }, []);

  const handleClearAll = useCallback(async () => {
    await clearStore();
  }, [clearStore]);

  const handleClearPlants = useCallback(async () => {
    await clearPlants();
  }, [clearPlants]);

  const handleClearSpecies = useCallback(async () => {
    await clearSpeciesCache();
  }, [clearSpeciesCache]);

  const handleReload = useCallback(() => {
    void reloadStore();
  }, [reloadStore]);

  const {
    renamePlant,
    deletePlant,
    undoDelete,
    editPlantDetails,
    undoState,
    errorMessage,
    clearError,
  } = usePlantActions({
    store,
    resolvePolicy,
    speciesProfiles,
  });

  const handleRenamePlant = useCallback(
    async (id: string, nickname: string | null) => {
      await renamePlant(id, nickname);
    },
    [renamePlant],
  );

  const handleDeletePlant = useCallback(
    async (id: string) => {
      await deletePlant(id);
    },
    [deletePlant],
  );

  const handleEditPlant = useCallback(
    async (id: string, input: EditPlantDetailsInput) => {
      await editPlantDetails(id, input);
    },
    [editPlantDetails],
  );

  const handleUndoDelete = useCallback(() => {
    void undoDelete();
  }, [undoDelete]);

  const handleDismissError = useCallback(() => {
    clearError();
  }, [clearError]);

  const heroStatus = (
    <div className="hero-status">
      <span className={`chip ${plantNetConfigured ? "chip--success" : "chip--warning"}`}>
        {plantNetConfigured ? "PlantNet connected" : "PlantNet needs setup"}
      </span>
      <span className={`chip ${openAiConfigured ? "chip--success" : "chip--info"}`}>
        {openAiConfigured ? "AI guidance live" : "Using default policies"}
      </span>
    </div>
  );

  const storageFootprint = useMemo(() => getStorageFootprint(), [getStorageFootprint, plants, speciesProfiles]);
  const appInfo = useMemo(getAppInfo, []);

  let content: JSX.Element;

  if (location.route === "settings") {
    content = (
      <div className="content-stack">
        <section className="page-hero page-hero--compact">
          <div>
            <h1>Settings</h1>
            <p>Control mock services, manage API keys, and reset local storage.</p>
          </div>
          {heroStatus}
        </section>
        <SettingsScreen
          config={uiConfig}
          onChange={handleConfigChange}
          onClearAll={handleClearAll}
          onClearPlants={handleClearPlants}
          onClearSpecies={handleClearSpecies}
          storageFootprint={storageFootprint}
          appInfo={appInfo}
        />
      </div>
    );
  } else if (location.route === "add") {
    content = <AddPlantScreen />;
  } else {
    content = (
      <div className="content-stack">
        <section className="page-hero page-hero--home">
          <div>
            <h1>Your indoor garden</h1>
            <p>Keep moisture policies and care notes organised. Everything stays on this device.</p>
          </div>
          <div className="home-hero-actions">
            <button
              className="primary-button"
              type="button"
              onClick={handleAddPlant}
              disabled={!canNavigateToAddPlant}
              aria-disabled={!canNavigateToAddPlant}
            >
              Add a plant
            </button>
            {heroStatus}
          </div>
        </section>
        <HomeScreen
          plants={plants}
          speciesCache={speciesProfiles}
          onAddPlant={handleAddPlant}
          status={homeStatus}
          errorMessage={hydrateError}
          onRetry={handleReload}
          onRenamePlant={handleRenamePlant}
          onDeletePlant={handleDeletePlant}
          onEditPlant={handleEditPlant}
          transientError={errorMessage}
          onDismissTransientError={handleDismissError}
        />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <main className="app-content">{content}</main>
      {undoState && (
        <Toast
          message={`Removed ${
            undoState.plant.nickname ||
            undoState.plant.speciesProfile?.commonName ||
            undoState.plant.speciesProfile?.canonicalName ||
            undoState.plant.speciesKey
          }.`}
          actionLabel="Undo"
          onAction={handleUndoDelete}
        />
      )}
      <TabNavigation />
    </div>
  );
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

  const initialConfig: UiConfig = useMemo(
    () => ({
      useMockPlantNet,
      useMockChatGpt,
      plantNetApiKey: plantNetAvailable ? "••••••" : "",
      openAiApiKey: openAiReady ? "••••••" : "",
    }),
    [openAiReady, plantNetAvailable, useMockChatGpt, useMockPlantNet],
  );

  return (
    <PlantCareProvider
      identificationProvider={identificationProvider}
      policyService={policyService}
      plantNetConfigured={plantNetAvailable}
      openAiConfigured={openAiReady}
    >
      <AppShell initialConfig={initialConfig} />
    </PlantCareProvider>
  );
};

export default App;
