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
          // 单 worker，避免并行内存爆炸
          pool: 'forks',
          poolOptions: {
            forks: {
              singleFork: true,
            },
          },
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
          // happy-dom 比 jsdom 内存低 50%
          environment: 'happy-dom',
          include: ['frontend/tests/**/*.test.{ts,tsx}'],
          // threads 单线程模式，内存最小
          pool: 'threads',
          poolOptions: {
            threads: {
              singleThread: true,
            },
          },
        },
      },
    ],
  },
});