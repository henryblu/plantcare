import { getEnvVar, getOptionalEnvVar } from './environment';

export interface AppInfo {
  version: string;
  buildMode: string;
  readmeUrl: string;
  helpUrl: string;
}

const sanitizeBaseUrl = (value: string): string => value.replace(/\/+$/, '');

const resolveRepositoryBase = (): string => {
  const fromEnv = getOptionalEnvVar('VITE_REPOSITORY_URL');
  if (fromEnv) {
    return sanitizeBaseUrl(fromEnv);
  }
  return 'https://github.com/openai/plantcare';
};

const resolveBuildMode = (): string => {
  const explicitMode = getOptionalEnvVar('VITE_APP_MODE');
  if (explicitMode) {
    return explicitMode;
  }
  const mode = getOptionalEnvVar('MODE');
  if (mode) {
    return mode;
  }
  const nodeEnv = getOptionalEnvVar('NODE_ENV');
  if (nodeEnv) {
    return nodeEnv;
  }
  return 'development';
};

const resolveVersion = (): string => {
  const explicit = getOptionalEnvVar('VITE_APP_VERSION');
  if (explicit) {
    return explicit;
  }
  const packageVersion = getOptionalEnvVar('npm_package_version');
  if (packageVersion) {
    return packageVersion;
  }
  return getEnvVar('APP_VERSION', '0.1.0');
};

export const getAppInfo = (): AppInfo => {
  const repositoryBase = resolveRepositoryBase();
  const base = sanitizeBaseUrl(repositoryBase);
  return {
    version: resolveVersion(),
    buildMode: resolveBuildMode(),
    readmeUrl: `${base}/blob/main/README.md`,
    helpUrl: `${base}/blob/main/docs/OPERATIONS.md`,
  };
};

