/// <reference types="vitest/config" />
import path from 'node:path';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, 'FRONTEND_PORT');
  const port = Number(env.FRONTEND_PORT || 2102);

  return {
    envPrefix: ['APP_URL', 'APP_API_URL', 'APP_ENV'],
    plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss()],
    resolve: {
      alias: { '@': path.resolve(import.meta.dirname, './src') },
    },
    server: { port, strictPort: true },
    preview: { port, strictPort: true },
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/ },
              { name: 'state', test: /node_modules[\\/](@reduxjs|react-redux|redux|redux-persist|@tanstack)[\\/]/ },
              { name: 'forms', test: /node_modules[\\/](react-hook-form|zod|@hookform)[\\/]/ },
            ],
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      testTimeout: 20_000,
    },
  };
});
