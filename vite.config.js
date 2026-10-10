import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import pluginBambu from './scripts/plugin-bambu.js';
import pluginOfuscar from './scripts/plugin-ofuscar.js';

export default defineConfig({
  plugins: [pluginBambu(), pluginOfuscar()],
  optimizeDeps: { exclude: ['manifold-3d'] },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 4000,
    sourcemap: false,                           // sem mapa do código-fonte em produção
    rollupOptions: {
      input: { site: resolve(__dirname, 'index.html'), admin: resolve(__dirname, 'admin.html') },
      output: {
        // bibliotecas num arquivo separado (não ofuscado)
        manualChunks: id => (id.includes('node_modules') ? 'libs' : undefined),
      },
    },
  },
  esbuild: { legalComments: 'none' },
  server: { port: 5173, open: true },
});
