export const PLANTNET_API_KEY = process.env.PLANTNET_API_KEY ?? '';
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';

export const REQUIRED_API_KEYS = {
  PLANTNET_API_KEY,
  OPENAI_API_KEY,
};

export default {
  PLANTNET_API_KEY,
  OPENAI_API_KEY,
  REQUIRED_API_KEYS,
};
