const env = (key: string): string => process.env[key] ?? '';

export const PLANTNET_API_KEY = env('PLANTNET_API_KEY');
export const OPENAI_API_KEY = env('OPENAI_API_KEY');

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