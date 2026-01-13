import react from '@vitejs/plugin-react';
import vitePluginBundleObfuscator from 'vite-plugin-bundle-obfuscator';
import tsconfigPaths from 'vite-tsconfig-paths';
import { coverageConfigDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths(), react({}), vitePluginBundleObfuscator()],
  assetsInclude: ['**/*.yaml'],
  test: {
    globals: true,
    silent: false,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.js'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        ...coverageConfigDefaults.exclude,
        '**/*.config.{js,ts}',
        'src/global.d.ts',
        'src/instrumentation.ts',
        'src/middleware.ts',
        'src/mocks/**',
        'src/test/**',
        'src/**/*.d.ts',
        'src/utils/test.ts',
        'src/vendor/**',
        'src/pages/**/*.tsx',
      ],
    },
  },
  build: {
    sourcemap: false,
  },
});
