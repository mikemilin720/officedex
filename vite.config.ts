import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { resolveUiKitBackendAlias } from "./src/renderer/ui/resolveUiKit";

const realE2E = Boolean(process.env.VITE_OFFICEDEX_REAL_E2E_ENDPOINT);
const rendererRoot = fileURLToPath(new URL("./src/renderer", import.meta.url));
const alias = [
  {
    find: "@vo-ui/backend",
    replacement: resolveUiKitBackendAlias(rendererRoot, process.env.UI_KIT),
  },
];

export default defineConfig({
  plugins: [react()],
  root: ".",
  base: "./",
  resolve: {
    alias,
    dedupe: ["react", "react-dom"],
  },
  server: realE2E ? { hmr: false } : undefined,
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["src/renderer/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "scripts/verify-wails-app.test.mjs"],
    exclude: ["e2e/**", "node_modules/**", "dist/**", "build/**"],
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
