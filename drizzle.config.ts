import { defineConfig } from "drizzle-kit";

// Loads .env automatically in Node
if (!process.env.POSTGRES_PASSWORD) {
  process.loadEnvFile?.(".env");
}

const host = process.env.PGHOST || "127.0.0.1";
const port = process.env.PGPORT || "54329";
const password = process.env.POSTGRES_PASSWORD || "";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  dbCredentials: {
    url: `postgresql://postgres:${password}@${host}:${port}/qp_sales`,
  },
});