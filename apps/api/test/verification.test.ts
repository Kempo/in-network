import { beforeAll, afterAll, expect, test } from "vitest";
import { config } from "dotenv";
config({ path: "../../.env" });

const { db, pool, waitForDb, runMigrations } = await import("../src/db/client.js");
const { carriers, networks, plans, providers, addresses, networkMemberships } = await import(
  "../src/db/schema.js"
);
const { verify } = await import("../src/lib/verification.js");
const { ResolveError } = await import("../src/lib/errors.js");

let planId: number, providerId: number, networkId: number;

beforeAll(async () => {
  await waitForDb();
  await runMigrations();
  const [c] = await db.insert(carriers).values({ name: "BS (verify-test)" }).returning();
  const [n] = await db.insert(networks).values({ title: "Trio (verify-test)", carrierId: c.id }).returning();
  networkId = n.id;
  const [pl] = await db
    .insert(plans)
    .values({ title: "Gold 80 (verify-test)", carrierId: c.id, networkId: n.id })
    .returning();
  planId = pl.id;
  const [a] = await db.insert(addresses).values({ locality: "SF", state: "CA", country: "USA" }).returning();
  const [p] = await db.insert(providers).values({ name: "Verify Provider", addressId: a.id }).returning();
  providerId = p.id;
});
afterAll(async () => {
  await pool.end();
});

test("no membership → found:false", async () => {
  const r = await verify({ providerId, planId });
  expect(r.found).toBe(false);
});

test("fresh network-level membership → found:true from cache", async () => {
  await db
    .insert(networkMemberships)
    .values({ status: "in_network", planId: null, providerId, networkId, refreshedAt: new Date() });
  const r = await verify({ providerId, planId });
  expect(r).toMatchObject({ found: true, status: "in_network", source: "cache" });
});

test("stale membership → found:false", async () => {
  const [c] = await db.insert(carriers).values({ name: "BS2 (verify-test)" }).returning();
  const [n] = await db.insert(networks).values({ title: "N2 (verify-test)", carrierId: c.id }).returning();
  const [pl] = await db
    .insert(plans)
    .values({ title: "P2 (verify-test)", carrierId: c.id, networkId: n.id })
    .returning();
  const old = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000); // 4 days > 3-day TTL
  await db
    .insert(networkMemberships)
    .values({ status: "in_network", planId: null, providerId, networkId: n.id, refreshedAt: old });
  const r = await verify({ providerId, planId: pl.id });
  expect(r.found).toBe(false);
});

test("unknown ids → ResolveError", async () => {
  await expect(verify({ providerId: 99999999, planId })).rejects.toBeInstanceOf(ResolveError);
  await expect(verify({ providerId, planId: 99999999 })).rejects.toBeInstanceOf(ResolveError);
});
