import { z } from "zod";

// The superuser password is deliberately absent: the app never connects as superuser.
const schema = z
  .object({
    PGHOST: z.string().min(1),
    PGPORT: z.coerce.number().int().positive(),
    QP_APP_PASSWORD: z.string().min(1),
    QP_READER_PASSWORD: z.string().min(1),
    LLM_PROVIDER: z.enum(["fake", "anthropic"]).default("fake"),
    ANTHROPIC_API_KEY: z.string().optional(),
  })
  .refine((e) => e.LLM_PROVIDER !== "anthropic" || !!e.ANTHROPIC_API_KEY, {
    path: ["ANTHROPIC_API_KEY"],
  });

export type Env = ReturnType<typeof parseEnv>;

export function parseEnv(source: Record<string, string | undefined> = process.env) {
  const result = schema.safeParse(source);
  if (!result.success) {
    // Names only, never values: zod messages can echo what they received.
    const names = [...new Set(result.error.issues.map((i) => i.path.join(".")))];
    throw new Error(`Invalid or missing environment variables: ${names.join(", ")}`);
  }
  const e = result.data;
  const server = { host: e.PGHOST, port: e.PGPORT };
  return {
    appDb: { ...server, database: "qp_app", user: "qp_app", password: e.QP_APP_PASSWORD },
    readerDb: { ...server, database: "qp_sales", user: "qp_reader", password: e.QP_READER_PASSWORD },
    llm: { provider: e.LLM_PROVIDER, apiKey: e.ANTHROPIC_API_KEY },
  };
}
