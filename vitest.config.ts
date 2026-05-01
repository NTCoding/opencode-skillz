import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["src/**/*.spec.ts", "src/**/*.spec.js"],
    coverage: {
      include: ["src/**/*.ts", "scripts/**/*.mjs"],
      exclude: ["src/**/*.spec.ts", "src/**/*-test-support.ts"],
      provider: "v8",
      reporter: ["text", "json-summary"],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
})
