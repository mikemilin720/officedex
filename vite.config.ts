import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const realE2E = Boolean(process.env.VITE_OFFICEDEX_REAL_E2E_ENDPOINT);

export default defineConfig({
  plugins: [react()],
  root: ".",
  base: "./",
  server: realE2E ? { hmr: false } : undefined,
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["src/renderer/test/setup.ts"],
    exclude: ["e2e/**", "node_modules/**", "dist/**", "build/**"],
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
