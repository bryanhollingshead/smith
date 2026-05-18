import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Forward /api → backend on 4000 so the client can use relative URLs in dev.
    // `ws: true` ensures WebSocket upgrade requests on /api/ws are forwarded too,
    // not just regular HTTP. Without it, the messaging client can't connect.
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
