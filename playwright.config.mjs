import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "test/e2e",
  timeout: 30_000,
  retries: 0,
  workers: 1, // one persistent browser context with the extension loaded
  use: { baseURL: "http://127.0.0.1:8907" },
  webServer: {
    command: "node test/fixtures/serve.mjs",
    port: 8907,
    reuseExistingServer: true,
  },
});
