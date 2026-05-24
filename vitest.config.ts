import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: __dirname,
  resolve: {
    preserveSymlinks: true,
  },
  test: {
    environment: 'node',
    include: ['api/**/*.test.js', 'src/**/*.test.ts'],
    pool: 'forks',
    clearMocks: true,
  },
});
