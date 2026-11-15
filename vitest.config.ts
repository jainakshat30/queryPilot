import { existsSync } from "node:fs";
import { defineConfig } from "vitest/config";

// Local runs read .env (Node built-in; real environment variables win). CI sets variables directly.
if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  test: { environment: "node" },
});
