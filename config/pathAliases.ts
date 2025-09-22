import path from 'node:path';

export const relativeAliasConfig = {
  '@core': 'core',
  '@services': 'services',
  '@config': 'config',
  '@app': 'app/src',
} as const;

export type RelativeAliasKey = keyof typeof relativeAliasConfig;

export const resolveAliasMap = (rootDir: string) =>
  Object.fromEntries(
    Object.entries(relativeAliasConfig).map(([alias, relativeTarget]) => [
      alias,
      path.resolve(rootDir, relativeTarget),
    ]),
  ) as Record<RelativeAliasKey, string>;

export const resolvedAliasPaths = (rootDir: string) =>
  Array.from(new Set(Object.values(resolveAliasMap(rootDir))));