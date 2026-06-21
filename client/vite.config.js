import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Inject the package.json version into the bundle as __APP_VERSION__. The
// feedback widget stamps it onto every Signal so we can correlate reports
// with a specific build. Falls back to "dev" if anything goes wrong.
const __dirname = dirname(fileURLToPath(import.meta.url));
let appVersion = 'dev';
try {
  const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'));
  appVersion = pkg.version || 'dev';
} catch { /* keep 'dev' */ }

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
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
