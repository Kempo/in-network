import { beforeAll, afterAll, expect, test } from "vitest";
import { config } from "dotenv";
config({ path: "../../.env" });

const { db, pool, waitForDb, runMigrations } = await import("../src/db/client.js");
const { carriers, networks, plans } = await import("../src/db/schema.js");
const { buildApp } = await import("../src/app.js");

const app = buildApp();

beforeAll(async () => {
  await waitForDb();
  await runMigrations();
  const [c] = await db.insert(carriers).values({ name: "BS (plans-test)" }).returning();
  const [n] = await db.insert(networks).values({ title: "Trio HMO (plans-test)", carrierId: c.id }).returning();
  await db.insert(plans).values({ title: "Gold 80 Trio HMO (plans-test)", carrierId: c.id, networkId: n.id });
});
afterAll(async () => {
  await pool.end();
});

test("GET /plans?name= returns matching plans", async () => {
  const res = await app.request("/plans?name=Gold%2080%20Trio");
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.plans.some((p: { title: string }) => p.title.includes("plans-test"))).toBe(true);
  expect(body.limit).toBe(10);
});
