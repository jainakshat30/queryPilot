import { handle } from "hono/vercel";
import { app } from "@/server/api";

app.get("/v1", (c) => {
  console.log(c);
  return c.json({ message: "Hello from Hono!" });
});

export const GET = handle(app);
export const POST = handle(app);