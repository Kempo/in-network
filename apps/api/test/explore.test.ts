import { beforeAll, afterAll, expect, test, vi } from "vitest";
import { config } from "dotenv";
config({ path: "../../.env" });

vi.mock("../src/lib/agent.js", () => ({
  callBrowserUse: vi.fn(async () => ({
    status: "in_network",
    provider: { name: "Dignity – Dominican", address: "1555 Soquel Dr", city: "Santa Cruz", state: "CA" },
    scope_hint: "network_level",
  })),
}));

const { db, pool, waitForDb, runMigrations } = await import("../src/db/client.js");
const { carriers, networks, plans, providerDirectories, networkMemberships, agentRuns } = await import(
  "../src/db/schema.js"
);
const { startExplore } = await import("../src/lib/explore.js");
import { eq } from "drizzle-orm";

let carrierId: number, planId: number, networkId: number;

const settle = async (runId: number) => {
  for (let i = 0; i < 50; i++) {
    const [run] = await db.select().from(agentRuns).where(eq(agentRuns.id, runId));
    if (run.status === "finished" || run.status === "failed") return run;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error("run did not settle");
};

beforeAll(async () => {
  await waitForDb();
  await runMigrations();
  const [c] = await db.insert(carriers).values({ name: "BS (explore-test)" }).returning();
  carrierId = c.id;
  const [n] = await db.insert(networks).values({ title: "Trio (explore-test)", carrierId: c.id }).returning();
  networkId = n.id;
  const [pl] = await db
    .insert(plans)
    .values({ title: "Gold 80 (explore-test)", carrierId: c.id, networkId: n.id })
    .returning();
  planId = pl.id;
  await db.insert(providerDirectories).values({ carrierId: c.id, url: "http://x", instructions: "find" });
});
afterAll(async () => {
  await pool.end();
});

test("explore with known planId: browses, inserts provider, records membership", async () => {
  const { runId } = await startExplore({ carrierId, planId, name: "Dignity – Dominican", location: "Santa Cruz, CA", city: "Santa Cruz", state: "CA" });
  const run = await settle(runId);
  expect(run.status).toBe("finished");
  const result = run.result as { providerId: number; planId: number; status: string };
  expect(result.status).toBe("in_network");

  const rows = await db
    .select()
    .from(networkMemberships)
    .where(eq(networkMemberships.providerId, result.providerId));
  expect(rows.length).toBe(1);
  expect(rows[0].networkId).toBe(networkId);
  expect(rows[0].planId).toBeNull(); // scope_hint = network_level
});

test("explore with new planName: find-or-creates a network + plan", async () => {
  const { runId } = await startExplore({
    carrierId,
    planName: "  Brand  New   Plan  ",
    name: "Some New Provider",
    location: "Santa Cruz, CA",
    city: "Santa Cruz",
    state: "CA",
  });
  const run = await settle(runId);
  expect(run.status).toBe("finished");
  const result = run.result as { planId: number };
  const [pl] = await db.select().from(plans).where(eq(plans.id, result.planId));
  expect(pl.title).toBe("Brand New Plan"); // whitespace sanitized
  const [net] = await db.select().from(networks).where(eq(networks.id, pl.networkId));
  expect(net.carrierId).toBe(carrierId);
});

test("startExplore rejects when neither planId nor planName is given", async () => {
  await expect(startExplore({ carrierId, name: "X", location: "Santa Cruz, CA" })).rejects.toThrow();
});

test("startExplore rejects when location is missing or blank", async () => {
  await expect(startExplore({ carrierId, planId, name: "X", location: "  " })).rejects.toThrow("location required");
});
