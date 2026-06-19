import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/api/gemini": {
        target: "http://localhost:3001",
        changeOrigin: true,
        // Must outlast the proxy's own 180s upstream timeout — otherwise a slow
        // thinking-heavy call (X-Ray, grounded search) gets a 504 from vite
        // here while the proxy is still working, surfacing as "trouble
        // connecting" even though nothing actually failed.
        timeout: 200000,
        proxyTimeout: 200000,
      },
      "/api/rate-limit-status": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "node",
  },
});
