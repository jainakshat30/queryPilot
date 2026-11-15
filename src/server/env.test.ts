import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

const valid = {
  PGHOST: "127.0.0.1",
  PGPORT: "54329",
  QP_APP_PASSWORD: "app-secret-value",
  QP_READER_PASSWORD: "reader-secret-value",
};

describe("parseEnv", () => {
  it("builds separate connection configs and defaults to the fake LLM", () => {
    const env = parseEnv(valid);
    expect(env.readerDb).toEqual({
      host: "127.0.0.1",
      port: 54329,
      database: "qp_sales",
      user: "qp_reader",
      password: "reader-secret-value",
    });
    expect(env.appDb.database).toBe("qp_app");
    expect(env.llm.provider).toBe("fake");
  });

  it("names missing variables without leaking any values", () => {
    const { QP_READER_PASSWORD: _omit, ...rest } = valid;
    expect(() => parseEnv({ ...rest, PGPORT: "not-a-port" })).toThrowError(
      /QP_READER_PASSWORD.*PGPORT|PGPORT.*QP_READER_PASSWORD/,
    );
    try {
      parseEnv({ ...rest, PGPORT: "not-a-port" });
    } catch (e) {
      const msg = (e as Error).message;
      for (const value of [...Object.values(rest), "not-a-port"]) expect(msg).not.toContain(value);
    }
  });

  it("treats an empty password as missing", () => {
    expect(() => parseEnv({ ...valid, QP_APP_PASSWORD: "" })).toThrowError(/QP_APP_PASSWORD/);
  });

  it("refuses the real LLM provider without an API key", () => {
    expect(() => parseEnv({ ...valid, LLM_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "" })).toThrowError(
      /ANTHROPIC_API_KEY/,
    );
    expect(parseEnv({ ...valid, LLM_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "k" }).llm.provider).toBe("anthropic");
  });
});
