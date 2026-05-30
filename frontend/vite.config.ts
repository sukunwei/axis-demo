import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: 'localhost',
    customLogger: {
      warn: () => {},
      error: () => {},
      info: () => {},
      warnOnce: () => {},
      errorOnce: () => {},
      clearScreen: () => {},
    },
    proxy: {
      '/context': 'http://localhost:5174',
      '/recommendations': 'http://localhost:5174',
      '/telemetry': 'http://localhost:5174',
    },
  },
});
