import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { agentRuns, type AgentRun } from "../db/schema.js";

export async function createRun(prompt: string): Promise<AgentRun> {
  const [run] = await db.insert(agentRuns).values({ prompt, status: "pending" }).returning();
  return run;
}

export async function markProcessing(id: number): Promise<void> {
  await db.update(agentRuns).set({ status: "processing", updatedAt: new Date() }).where(eq(agentRuns.id, id));
}

export async function markFinished(id: number, result: unknown): Promise<void> {
  await db.update(agentRuns).set({ status: "finished", result, updatedAt: new Date() }).where(eq(agentRuns.id, id));
}

export async function markFailed(id: number, error: string): Promise<void> {
  await db.update(agentRuns).set({ status: "failed", error, updatedAt: new Date() }).where(eq(agentRuns.id, id));
}
