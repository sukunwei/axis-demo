import { defineConfig, type Logger } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

function silentLogger(): Logger {
  const noop = () => {};
  return {
    info: noop,
    warn: noop,
    error: noop,
    warnOnce: noop,
    errorOnce: noop,
    clearScreen: noop,
    hasErrorLogged: () => false,
    hasWarned: false,
    printUrls: noop,
    outputOptions: {},
    close: noop,
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: 'localhost',
    customLogger: silentLogger(),
    proxy: {
      '/context': 'http://localhost:5174',
      '/recommendations': 'http://localhost:5174',
      '/telemetry': 'http://localhost:5174',
    },
  },
});
