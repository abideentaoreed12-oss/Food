import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    fileParallelism: false,
    testTimeout: 15000,
    env: {
      JWT_SECRET: 'test-only-secret-not-for-production',
      ADMIN_EMAIL: 'admin@veyrang.com',
      ADMIN_PASSWORD: 'AdminSecurePassword123!',
    },
  },
});
