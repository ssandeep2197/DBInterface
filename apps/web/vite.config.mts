import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { resolve } from 'node:path';

export default defineConfig({
  root: __dirname,
  plugins: [react(), tsconfigPaths({ projects: [resolve(__dirname, 'tsconfig.app.json')] })],
  resolve: {
    alias: {
      '@dbi/shared': resolve(__dirname, '../../libs/shared/src/index.ts'),
    },
  },
  build: {
    outDir: '../../dist/apps/web',
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    port: 4200,
    proxy: {
      '/api': { target: 'http://localhost:8082', changeOrigin: true },
      '/auth': { target: 'http://localhost:8082', changeOrigin: true },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
  },
});
