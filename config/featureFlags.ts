import { getBooleanEnvVar } from './environment';

export const FEATURE_PLANTNET = getBooleanEnvVar('FEATURE_PLANTNET', true);
export const FEATURE_CHATGPT = getBooleanEnvVar('FEATURE_CHATGPT', true);
export const USE_MOCKS = getBooleanEnvVar('USE_MOCKS', false);

export default {
  FEATURE_PLANTNET,
  FEATURE_CHATGPT,
  USE_MOCKS,
};
