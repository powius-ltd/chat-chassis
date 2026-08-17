import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [tsconfigPaths()],
        test: {
          name: "unit",
          environment: "node",
          include: ["engine/tests/unit/**/*.test.ts"],
        },
      },
      {
        plugins: [tsconfigPaths()],
        test: {
          // Run by a consuming project (`npm run verify`) to check its own
          // src/chat-knowledge.ts and src/chat-copy/* against the chassis
          // contracts — not part of the chassis's own `npm test`.
          name: "conformance",
          environment: "node",
          include: ["engine/tests/conformance/**/*.test.ts"],
        },
      },
    ],
  },
});
