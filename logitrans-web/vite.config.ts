import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En desarrollo Vite reenvía /api a Servidor.js (en producción lo hace IIS con URL Rewrite + ARR)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://127.0.0.1:3000', changeOrigin: false } },
  },
  build: { sourcemap: false },
});
