import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["src/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: [
        "src/tools/lint-review.ts",
        "src/tools/pull-request-files.ts",
        "src/tools/vitest-coverage.ts",
      ],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
})
