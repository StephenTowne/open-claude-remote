import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

const sharedAlias = {
  '#shared': resolve(__dirname, 'shared/index.ts'),
};

export default defineConfig({
  test: {
    projects: [
      {
        resolve: {
          alias: sharedAlias,
        },
        test: {
          name: 'backend',
          globals: true,
          environment: 'node',
          include: ['backend/tests/**/*.test.ts'],
        },
      },
      {
        plugins: [react()],
        resolve: {
          alias: sharedAlias,
        },
        test: {
          name: 'frontend',
          globals: true,
          environment: 'jsdom',
          include: ['frontend/tests/**/*.test.{ts,tsx}'],
        },
      },
    ],
  },
});