import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/ui/test/setup.ts'],
    include: ['./src/ui/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/ui/test/',
      ],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/ui'),
    },
  },
});