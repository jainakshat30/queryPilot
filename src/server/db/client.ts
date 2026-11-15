import { Pool, QueryResultRow} from "pg"
import { parseEnv } from "../env"

const env = parseEnv()

export const readerPool = new Pool({
    ...env.readerDb, // Spread syntax (...): copies { host, port, database, user, password } from env.readerDb
    max: 10, // max number of simultaneous open connections
    idleTimeoutMillis: 30000, //how many ms a connection can sit unused before being closed (30 sec)
    connectionTimeoutMillis: 2000, //how many ms to wait when req a connection before timing out
})


export interface ExecuteResult {
    columns: string[];
    rows: QueryResultRow[];
    rowCount: number;
    executionTimeMs: number;
}

export async function executeSafeQuery(sql: string): Promise<ExecuteResult> {
    const client = await readerPool.connect();
    const startTime = performance.now();

    try{
        await client.query("SET statement_timeout = 5000");
        const result = await client.query(sql);

        const executionTimeMs = Math.round(performance.now() - startTime);

        return {
            columns: result.fields ? result.fields.map((field) => field.name) : [],
            // The actual array of row objects
            rows: result.rows,
            rowCount: result.rowCount ?? result.rows.length,
            executionTimeMs,
        }
    }finally {
            await client.query("SET statement_timeout = DEFAULT;").catch(() => {});
            client.release();
    }
}