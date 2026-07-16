import { defineConfig } from "vitest/config";
import path from "node:path";

// B1 — vitest-config voor server-side contract-/gedragstests. Node-omgeving
// (geen DOM), en dezelfde path-aliassen als tsconfig zodat @shared/@ resolven.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
      "@": path.resolve(__dirname, "client/src"),
    },
  },
});
