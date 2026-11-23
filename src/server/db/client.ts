// ============================================================================
// IMPORTS
// ============================================================================

import { Pool, type QueryResultRow } from "pg";
import { parseEnv } from "../env";

// 1. Get validated database configurations for both qp_sales and qp_app
const env = parseEnv();

// ============================================================================
// 1. READER POOL (qp_sales database - Read Only)
// ============================================================================

/**
 * Dedicated pool for running generated SQL queries against qp_sales.
 * Uses role 'qp_reader' which only has SELECT privileges.
 */
export const readerPool = new Pool({
  ...env.readerDb,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export interface ExecuteResult {
  columns: string[];
  rows: QueryResultRow[];
  rowCount: number;
  executionTimeMs: number;
}

/**
 * Executes a read-only query against qp_sales with a strict 5-second timeout.
 */
export async function executeSafeQuery(sql: string): Promise<ExecuteResult> {
  const client = await readerPool.connect();
  const startTime = performance.now();

  try {
    // Safety guardrail: abort if query runs longer than 5 seconds
    await client.query("SET statement_timeout = 5000;");

    const result = await client.query(sql);
    const executionTimeMs = Math.round(performance.now() - startTime);

    return {
      columns: result.fields ? result.fields.map((field) => field.name) : [],
      rows: result.rows,
      rowCount: result.rowCount ?? result.rows.length,
      executionTimeMs,
    };
  } finally {
    await client.query("SET statement_timeout = DEFAULT;").catch(() => {});
    client.release();
  }
}

// ============================================================================
// 2. APP POOL (qp_app database - Read & Write for App Metadata)
// ============================================================================

/**
 * Dedicated pool for application data (history, metrics, logs).
 * Uses role 'qp_app' on database 'qp_app'.
 */
export const appPool = new Pool({
  ...env.appDb,
  max: 5,
  idleTimeoutMillis: 30000,
});

export interface QueryHistoryItem {
  id: number;
  question: string;
  sql: string;
  explanation: string;
  rowCount: number;
  executionTimeMs: number;
  createdAt: string;
}

/**
 * Saves a completed query to the history table in qp_app.
 * Creates the table automatically if it doesn't exist yet.
 */
export async function saveQueryHistory(data: {
  question: string;
  sql: string;
  explanation: string;
  rowCount: number;
  executionTimeMs: number;
}): Promise<void> {
  // Ensure the table exists in qp_app
  await appPool.query(`
    CREATE TABLE IF NOT EXISTS query_history (
      id SERIAL PRIMARY KEY,
      question TEXT NOT NULL,
      sql TEXT NOT NULL,
      explanation TEXT NOT NULL,
      row_count INTEGER NOT NULL DEFAULT 0,
      execution_time_ms INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  // Insert the query record
  await appPool.query(
    `
    INSERT INTO query_history (question, sql, explanation, row_count, execution_time_ms)
    VALUES ($1, $2, $3, $4, $5);
    `,
    [
      data.question,
      data.sql,
      data.explanation,
      data.rowCount,
      data.executionTimeMs,
    ]
  );
}

/**
 * Fetches the most recent query history items ordered by newest first.
 */
export async function getRecentQueryHistory(limit = 10): Promise<QueryHistoryItem[]> {
  // Ensure the table exists before querying
  await appPool.query(`
    CREATE TABLE IF NOT EXISTS query_history (
      id SERIAL PRIMARY KEY,
      question TEXT NOT NULL,
      sql TEXT NOT NULL,
      explanation TEXT NOT NULL,
      row_count INTEGER NOT NULL DEFAULT 0,
      execution_time_ms INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  const res = await appPool.query<QueryHistoryItem>(
    `
    SELECT 
      id, 
      question, 
      sql, 
      explanation, 
      row_count AS "rowCount", 
      execution_time_ms AS "executionTimeMs", 
      created_at AS "createdAt"
    FROM query_history
    ORDER BY created_at DESC
    LIMIT $1;
    `,
    [limit]
  );

  return res.rows;
}