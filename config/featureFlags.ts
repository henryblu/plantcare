import { getBooleanEnvVar } from "./environment";

export const FEATURE_PLANTNET = getBooleanEnvVar("FEATURE_PLANTNET", true);
export const FEATURE_CHATGPT = getBooleanEnvVar("FEATURE_CHATGPT", true);
export const USE_MOCK_PLANTNET = getBooleanEnvVar("USE_MOCK_PLANTNET", false);
export const USE_MOCK_CHATGPT = getBooleanEnvVar("USE_MOCK_CHATGPT", false);

export default {
  FEATURE_PLANTNET,
  FEATURE_CHATGPT,
  USE_MOCK_PLANTNET,
  USE_MOCK_CHATGPT,
};
