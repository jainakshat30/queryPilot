import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const queryHistory = pgTable("query_history", {
    id: serial("id").primaryKey(),
    question: text("question").notNull(),
    sql: text("sql").notNull(),
    explanation: text("explanation").notNull(),
    rowCount: integer("row_count").notNull().default(0),
    executionTimeMs: integer("execution_time_ms").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
})

