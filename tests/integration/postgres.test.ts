import { Client } from "pg";
import { expect, it } from "vitest";

// Test-only superuser connection. The app itself never connects as superuser.
it("server is PostgreSQL 18, matching the SQL parser's grammar", async () => {
  const client = new Client({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT),
    user: "postgres",
    password: process.env.POSTGRES_PASSWORD,
    database: "postgres",
  });
  await client.connect();
  try {
    const { rows } = await client.query<{ server_version_num: string }>("SHOW server_version_num");
    expect(Math.floor(Number(rows[0].server_version_num) / 10000)).toBe(18);
  } finally {
    await client.end();
  }
});
