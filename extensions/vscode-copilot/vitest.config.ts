import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    // catalog-data.json is imported as a JSON module — resolved by Vite natively
    include: ['tests/**/*.test.ts'],
  },
});
