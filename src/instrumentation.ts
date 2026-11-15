// Runs once at server start: refuse to boot with missing or invalid configuration.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") (await import("./server/env")).parseEnv();
}
