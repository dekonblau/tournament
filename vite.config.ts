import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Vite serves several module types with wrong Content-Type headers.
// Desktop Chrome is lenient for localhost, but remote Chrome enforces MIME types
// strictly when nginx adds X-Content-Type-Options: nosniff, silently killing
// the entire module chain. Fix all affected cases:
//   text/css  → CSS modules transformed to JS (except ?direct = raw CSS)
//   text/html → Vite virtual modules like /@vite/client, /@react-refresh
const fixModuleMime: Plugin = {
  name: 'fix-module-mime',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const orig = res.setHeader.bind(res);
      (res as NodeJS.Dict<unknown>).setHeader = (name: string, value: unknown) => {
        if (name.toLowerCase() === 'content-type' && typeof value === 'string') {
          const url = req.url ?? '';
          if (value.startsWith('text/css') && !url.includes('?direct')) {
            return orig(name, 'text/javascript');
          }
          if (value.startsWith('text/html') && url.startsWith('/@')) {
            return orig(name, 'text/javascript');
          }
        }
        return orig(name, value as string);
      };
      next();
    });
  },
};

export default defineConfig({
  plugins: [react(), fixModuleMime],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: ['itadria.net'],
    hmr: {
      // When accessed through nginx reverse proxy (itadria.net → Pi:5173),
      // tell the HMR client to connect the WebSocket on port 443 (the nginx port)
      // instead of guessing the internal Vite port. Nginx must forward WebSocket
      // upgrades — add these headers to your nginx location block:
      //   proxy_http_version 1.1;
      //   proxy_set_header Upgrade $http_upgrade;
      //   proxy_set_header Connection "upgrade";
      clientPort: 443,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  // brackets-manager and better-sqlite3 now live server-side only —
  // only the viewer CSS/JS is used client-side (loaded via CDN at runtime)
  optimizeDeps: {
    exclude: ['brackets-manager', 'better-sqlite3'],
  },
});
