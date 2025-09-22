import { resolveAliasMap } from './config/pathAliases';
import { defineConfig } from 'vitest/config';

const aliasMap = resolveAliasMap(__dirname);

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
    exclude: ['node_modules', 'dist'],
  },
  resolve: {
    alias: aliasMap,
  },
});