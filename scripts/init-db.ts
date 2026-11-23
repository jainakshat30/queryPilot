import { Client } from "pg";

// 1. Load .env if not already in environment
if (!process.env.POSTGRES_PASSWORD) {
  process.loadEnvFile?.(".env");
}

function escapeSqlString(str: string): string {
  return str.replace(/'/g, "''");
}

async function run() {
  const host = process.env.PGHOST || "127.0.0.1";
  const port = Number(process.env.PGPORT || "54329");
  const superuserPassword = process.env.POSTGRES_PASSWORD;
  const qpAppPassword = process.env.QP_APP_PASSWORD;
  const qpReaderPassword = process.env.QP_READER_PASSWORD;

  if (!superuserPassword || !qpAppPassword || !qpReaderPassword) {
    throw new Error("Missing required database passwords in .env");
  }

  console.log("Connecting as postgres superuser...");

  const rootClient = new Client({
    host,
    port,
    user: "postgres",
    password: superuserPassword,
    database: "postgres",
  });

  await rootClient.connect();

  try {
    // 2. Create databases if they don't exist
    for (const dbName of ["qp_sales", "qp_app"]) {
      const check = await rootClient.query(
        "SELECT 1 FROM pg_database WHERE datname = $1",
        [dbName]
      );
      if (check.rowCount === 0) {
        await rootClient.query(`CREATE DATABASE "${dbName}"`);
        console.log(`✓ Created database: ${dbName}`);
      } else {
        console.log(`- Database already exists: ${dbName}`);
      }
    }

    // 3. Create or update roles with passwords from .env
    const roles: { name: string; pass: string }[] = [
      { name: "qp_reader", pass: qpReaderPassword },
      { name: "qp_app", pass: qpAppPassword },
    ];

    for (const role of roles) {
      await rootClient.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${role.name}') THEN
            CREATE ROLE "${role.name}" WITH LOGIN PASSWORD '${escapeSqlString(role.pass)}';
          ELSE
            ALTER ROLE "${role.name}" WITH PASSWORD '${escapeSqlString(role.pass)}';
          END IF;
        END
        $$;
      `);
      console.log(`✓ Configured role: ${role.name}`);
    }
  } finally {
    await rootClient.end();
  }

  // 4. Connect to qp_sales to configure read-only permissions for qp_reader
  const salesClient = new Client({
    host,
    port,
    user: "postgres",
    password: superuserPassword,
    database: "qp_sales",
  });

  await salesClient.connect();
  try {
    await salesClient.query(`
      GRANT CONNECT ON DATABASE qp_sales TO qp_reader;
      GRANT USAGE ON SCHEMA public TO qp_reader;
      GRANT SELECT ON ALL TABLES IN SCHEMA public TO qp_reader;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO qp_reader;
    `);
    console.log("✓ Configured read-only permissions for qp_reader on qp_sales");
  } finally {
    await salesClient.end();
  }

  // 5. Connect to qp_app to configure full permissions for qp_app
  const appClient = new Client({
    host,
    port,
    user: "postgres",
    password: superuserPassword,
    database: "qp_app",
  });

  await appClient.connect();
  try {
    await appClient.query(`
      GRANT ALL PRIVILEGES ON DATABASE qp_app TO qp_app;
      GRANT ALL ON SCHEMA public TO qp_app;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO qp_app;
    `);
    console.log("✓ Configured app permissions for qp_app on qp_app");
  } finally {
    await appClient.end();
  }

  console.log("\n Database initialization complete!");
}

run().catch((err) => {
  console.error("Initialization failed:", err);
  process.exit(1);
});
