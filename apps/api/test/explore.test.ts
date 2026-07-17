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
const { carriers, networks, plans, providerDirectories, networkMemberships, agentRuns, addresses, providers } =
  await import("../src/db/schema.js");
const { startExplore } = await import("../src/lib/explore.js");
const { MissingInputsError } = await import("../src/lib/errors.js");
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

test("startExplore rejects when a run is needed but location is blank", async () => {
  await expect(
    startExplore({ carrierId, planId, name: "X", location: "  " }),
  ).rejects.toMatchObject({ missing: ["location"] });
});

test("startExplore short-circuits with a cached answer when one is already fresh", async () => {
  const [addr] = await db.insert(addresses).values({ locality: "Santa Cruz", state: "CA" }).returning();
  const [provider] = await db
    .insert(providers)
    .values({ name: "Cached Provider", addressId: addr.id })
    .returning();
  await db.insert(networkMemberships).values({
    status: "in_network",
    planId,
    providerId: provider.id,
    networkId,
    refreshedAt: new Date(),
  });
  const runsBefore = await db.select().from(agentRuns);

  const result = await startExplore({
    carrierId,
    planId,
    providerId: provider.id,
    location: "Santa Cruz, CA",
  });

  expect(result).toMatchObject({ found: true, status: "in_network", source: "cache" });
  expect("runId" in result).toBe(false);
  const runsAfter = await db.select().from(agentRuns);
  expect(runsAfter.length).toBe(runsBefore.length);
});

test("startExplore starts a run when the cached answer is stale", async () => {
  const [addr] = await db.insert(addresses).values({ locality: "Santa Cruz", state: "CA" }).returning();
  const [provider] = await db
    .insert(providers)
    .values({ name: "Stale Provider", addressId: addr.id })
    .returning();
  const stale = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000); // older than 3-day TTL
  await db.insert(networkMemberships).values({
    status: "out_of_network",
    planId,
    providerId: provider.id,
    networkId,
    refreshedAt: stale,
  });

  const result = await startExplore({
    carrierId,
    planId,
    providerId: provider.id,
    location: "Santa Cruz, CA",
  });

  expect("runId" in result).toBe(true);
});

test("cache hit needs neither carrierId nor location", async () => {
  const [addr] = await db.insert(addresses).values({ locality: "Santa Cruz", state: "CA" }).returning();
  const [provider] = await db.insert(providers).values({ name: "No-Inputs Cached", addressId: addr.id }).returning();
  await db.insert(networkMemberships).values({
    status: "in_network", planId, providerId: provider.id, networkId, refreshedAt: new Date(),
  });

  const result = await startExplore({ planId, providerId: provider.id });

  expect(result).toMatchObject({ found: true, status: "in_network", source: "cache" });
});

test("cache miss without carrierId or location throws MissingInputsError listing both", async () => {
  const [addr] = await db.insert(addresses).values({ locality: "Santa Cruz", state: "CA" }).returning();
  const [provider] = await db.insert(providers).values({ name: "No Membership", addressId: addr.id }).returning();

  await expect(startExplore({ planId, providerId: provider.id })).rejects.toMatchObject({
    constructor: MissingInputsError,
    missing: ["carrierId", "location"],
  });
});

test("cache hit via planName when the named plan is already on file", async () => {
  const [addr] = await db.insert(addresses).values({ locality: "Santa Cruz", state: "CA" }).returning();
  const [provider] = await db
    .insert(providers)
    .values({ name: "PlanName Cached", addressId: addr.id })
    .returning();
  await db.insert(networkMemberships).values({
    status: "in_network", planId, providerId: provider.id, networkId, refreshedAt: new Date(),
  });
  const runsBefore = await db.select().from(agentRuns);

  const result = await startExplore({
    carrierId,
    planName: "  Gold 80   (explore-test) ", // resolves to the seeded plan title after sanitizing
    providerId: provider.id,
    location: "Santa Cruz, CA",
  });

  expect(result).toMatchObject({ found: true, status: "in_network", source: "cache" });
  const runsAfter = await db.select().from(agentRuns);
  expect(runsAfter.length).toBe(runsBefore.length);
});

test("planName cache-miss run records the membership against the plan's real network", async () => {
  const [addr] = await db.insert(addresses).values({ locality: "Santa Cruz", state: "CA" }).returning();
  const [provider] = await db
    .insert(providers)
    .values({ name: "PlanName Miss", addressId: addr.id })
    .returning();
  const networksBefore = await db.select().from(networks);

  const result = await startExplore({
    carrierId,
    planName: "Gold 80 (explore-test)", // plan is on file (network 'Trio'), but no membership yet
    providerId: provider.id,
    location: "Santa Cruz, CA",
  });

  expect("runId" in result).toBe(true);
  const run = await settle((result as { runId: number }).runId);
  expect(run.status).toBe("finished");

  const rows = await db
    .select()
    .from(networkMemberships)
    .where(eq(networkMemberships.providerId, provider.id));
  expect(rows.length).toBe(1);
  expect(rows[0].networkId).toBe(networkId); // the plan's real network, not a freshly-invented one

  const networksAfter = await db.select().from(networks);
  expect(networksAfter.length).toBe(networksBefore.length); // no junk network created
});
