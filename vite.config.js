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
    // §96: tests run flag-OFF by default (the regression baseline) regardless of a local
    // .env that sets VITE_SUPABASE_* for the dev preview. Tests that need the client
    // opt in explicitly via vi.stubEnv; the outbox/data-layer tests mock the SDK entirely.
    env: { VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "" },
  },
});
