import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/api/anthropic": {
        target: "http://localhost:3001",
        changeOrigin: true,
        timeout: 120000,
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
