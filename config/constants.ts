import { getEnvVar } from './environment';

export const PLANTNET_API_KEY = getEnvVar('PLANTNET_API_KEY');
export const OPENAI_API_KEY = getEnvVar('OPENAI_API_KEY');

export const REQUIRED_API_KEYS = Object.freeze({
  PLANTNET_API_KEY: 'PLANTNET_API_KEY',
  OPENAI_API_KEY: 'OPENAI_API_KEY',
});

export const API_KEYS = Object.freeze({
  PLANTNET_API_KEY,
  OPENAI_API_KEY,
});

export default {
  PLANTNET_API_KEY,
  OPENAI_API_KEY,
  REQUIRED_API_KEYS,
  API_KEYS,
};
