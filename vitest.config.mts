import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  assetsInclude: ['**/*.yaml'],
  test: {
    exclude: ['tests/**', 'node_modules/**', 'packages/**/node_modules/**'],
  },
});
