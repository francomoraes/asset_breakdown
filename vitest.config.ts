import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    globals: true,
    passWithNoTests: true,
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    exclude: ["dist/**", "node_modules/**"],
    setupFiles: ["./tests/setup/unit.setup.ts"],
    restoreMocks: true,
    clearMocks: true,
    mockReset: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "./coverage",
    },
  },
});
