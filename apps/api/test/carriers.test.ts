import { beforeAll, afterAll, expect, test } from "vitest";
import { config } from "dotenv";
config({ path: "../../.env" });

const { db, pool, waitForDb, runMigrations } = await import("../src/db/client.js");
const { carriers } = await import("../src/db/schema.js");
const { buildApp } = await import("../src/app.js");

const app = buildApp();

beforeAll(async () => {
  await waitForDb();
  await runMigrations();
  await db.insert(carriers).values({ name: "Blue Shield of California (carriers-test)" });
});
afterAll(async () => {
  await pool.end();
});

test("GET /carriers?name= returns matching carriers", async () => {
  const res = await app.request("/carriers?name=Blue%20Shield%20California");
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.limit).toBe(10);
  expect(body.offset).toBe(0);
  expect(body.carriers.some((c: { name: string }) => c.name.includes("carriers-test"))).toBe(true);
});

test("GET /carriers honors limit", async () => {
  const res = await app.request("/carriers?limit=1");
  const body = await res.json();
  expect(body.carriers.length).toBeLessThanOrEqual(1);
  expect(body.limit).toBe(1);
});
