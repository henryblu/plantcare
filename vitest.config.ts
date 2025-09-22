import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
    exclude: ['node_modules', 'dist'],
  },
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, 'core'),
      '@services': path.resolve(__dirname, 'services'),
      '@config': path.resolve(__dirname, 'config'),
      '@app': path.resolve(__dirname, 'app/src'),
    },
  },
});
