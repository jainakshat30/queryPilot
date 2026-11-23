import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator"
import z from "zod";
import { executeSafeQuery, getRecentQueryHistory, saveQueryHistory } from "./db/client";
import { generateSql } from "./ai/generate";

export const app = new Hono().basePath("/api");

const FORBIDDEN_SQL_KEYWORDS = [
    "INSERT",
    "UPDATE",
    "DELETE",
    "DROP",
    "ALTER",
    "TRUNCATE",
    "GRANT",
    "REVOKE",
    "CREATE",
];

export function assertReadOnlySql(sql: string): void {
    const stripped = sql
        .replace(/--.*$/gm, "")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .trim();

    if (!stripped) {
        throw new Error("SQL query cannot be empty")
    }

    const startsWithRead = /^(SELECT|WITH)\b/i.test(stripped);

    if (!startsWithRead) {
        throw new Error("Only read-only SELECT or WITH statements are allowed");
    }

    const withoutTrailingSemicolon = stripped.replace(/;\s*$/, "");

    if (withoutTrailingSemicolon.includes(";")) {
        throw new Error("Multiple SQL statements separated by semicolons are not permitted");
    }

    for (const keyword of FORBIDDEN_SQL_KEYWORDS) {
        const regex = new RegExp(`\\b${keyword}\\b`, "i");
        if (regex.test(withoutTrailingSemicolon)) {
            throw new Error(`Forbidden keyword detected: '${keyword}' is not allowed`);
        }
    }
}

const questionRequestSchema = z.object({
    question: z
        .string()
        .min(2, "Question must be at least 2 characters long")
        .max(500, "Question cannot exceed 500 characters"),
});
// Validates requests that receive raw SQL to run
const executeRequestSchema = z.object({
    sql: z.string().min(1, "SQL string cannot be empty"),
});


app.get("/health", (c) => {
    return c.json({ ok: true })
})

//route 2 : POST /api/generate

app.post("/generate", zValidator("json", questionRequestSchema), async (c) => {
    const { question } = c.req.valid("json");

    try {
        const generated = await generateSql(question);
        return c.json({
            ok: true,
            data: generated,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to generate SQL";
        return c.json({ ok: false, error: message }, 500);
    }
})

//route 3 : POST /api/execute

app.post("/execute", zValidator("json", executeRequestSchema), async (c) => {
    const { sql } = c.req.valid("json");

    try {
        assertReadOnlySql(sql)

        const result = await executeSafeQuery(sql)

        return c.json({
            ok: true,
            data: result
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : "Query execution failed";
        return c.json({ ok: false, error: message }, 400);
    }
})

//route 4 : POST /api/query

app.post("/query", zValidator("json", questionRequestSchema), async (c) => {
    const { question } = c.req.valid("json")

    try {
        const generated = await generateSql(question)
        assertReadOnlySql(generated.sql)
        const result = await executeSafeQuery(generated.sql)

        // Save to history in qp_app
        await saveQueryHistory({
            question,
            sql: generated.sql,
            explanation: generated.explanation,
            rowCount: result.rowCount,
            executionTimeMs: result.executionTimeMs,
        }).catch((err) => console.error("Failed to save history:", err));

        return c.json({
            ok: true,
            sql: generated.sql,
            explanation: generated.explanation,
            tablesUsed: generated.tablesUsed,
            result
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : "Text-to-SQL pipeline failed";
        return c.json({ ok: false, error: message }, 400);
    }


})

/**
 * GET /api/history
 *
 * Retrieves the 10 most recent queries asked by users.
 */

app.get("/history", async (c) => {
    try {
        const history = await getRecentQueryHistory(10);
        return c.json({
            ok: true,
            data: history
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch history";
        return c.json({ ok: false, error: message }, 500);
    }

})