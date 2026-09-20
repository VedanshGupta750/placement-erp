import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
      // Next.js's bundler swaps this for a no-op in server-graph builds;
      // vitest has no such graph, so it hits the real package, which always
      // throws. Route it to a no-op here too — the guarantee it enforces
      // (server-only code never ships to the client) is a bundler-time
      // concern, not something a Node test run needs to re-check.
      "server-only": path.resolve(import.meta.dirname, "lib/__test-stubs__/server-only.ts"),
    },
  },
  test: {
    environment: "node",
  },
});
