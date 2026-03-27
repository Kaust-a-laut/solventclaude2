import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', '**/cypress/**', '**/.{idea,git,cache,output,temp}/**'],
    env: {
      BACKEND_INTERNAL_SECRET: 'test_secret_key_for_testing_purposes_only_1234567890'
    }
  },
});
