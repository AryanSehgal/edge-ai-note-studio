import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    // transformers.js (onnxruntime-web) ships large WASM/ESM assets that must NOT be
    // pre-bundled by Vite; it is loaded directly inside the Web Workers instead.
    optimizeDeps: {
      exclude: ['@huggingface/transformers'],
    },
    worker: {
      format: 'es' as const,
    },
    build: {
      target: 'esnext',
      chunkSizeWarningLimit: 4000,
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
