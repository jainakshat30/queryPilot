import { expect, it } from "vitest";
import { app } from "./api";

it("GET /api/health responds in-process, no server needed", async () => {
  const res = await app.request("/api/health");
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
});
