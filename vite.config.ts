import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  host: '0.0.0.0',
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    allowedHosts: ['itadria.net'],
    proxy: {
      // In dev, proxy /api/* to the Express server so CORS is never an issue
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
