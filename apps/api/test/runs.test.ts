import { beforeAll, afterAll, expect, test } from "vitest";
import { config } from "dotenv";
config({ path: "../../.env" });
const { db, pool, waitForDb, runMigrations } = await import("../src/db/client.js");
const { agentRuns } = await import("../src/db/schema.js");
const { createRun, markProcessing, markFinished, markFailed } = await import("../src/lib/runs.js");
import { eq } from "drizzle-orm";

beforeAll(async () => {
  await waitForDb();
  await runMigrations();
});
afterAll(async () => {
  await pool.end();
});

test("run lifecycle: pending → processing → finished", async () => {
  const run = await createRun("test prompt");
  expect(run.status).toBe("pending");
  await markProcessing(run.id);
  await markFinished(run.id, { status: "in_network" });
  const [row] = await db.select().from(agentRuns).where(eq(agentRuns.id, run.id));
  expect(row.status).toBe("finished");
  expect(row.result).toEqual({ status: "in_network" });
});

test("markFailed records the error", async () => {
  const run = await createRun("p");
  await markFailed(run.id, "boom");
  const [row] = await db.select().from(agentRuns).where(eq(agentRuns.id, run.id));
  expect(row.status).toBe("failed");
  expect(row.error).toBe("boom");
});
