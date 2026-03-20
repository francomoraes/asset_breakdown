"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("vitest/config");
exports.default = (0, config_1.defineConfig)({
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
