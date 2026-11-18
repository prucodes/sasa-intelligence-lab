import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {jsx: 'automatic'},
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    // Whole-screen renders (atlas, heroes) take a few seconds under jsdom; 5s timed out when the
    // machine was busy compiling. A failure here should mean a wrong result, not a slow machine.
    testTimeout: 15000,
  },
  resolve: {
    alias: { '@': new URL('./', import.meta.url).pathname },
  },
});
