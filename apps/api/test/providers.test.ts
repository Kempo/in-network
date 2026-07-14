import { beforeAll, afterAll, expect, test } from "vitest";
import { config } from "dotenv";
config({ path: "../../.env" });

const { db, pool, waitForDb, runMigrations } = await import("../src/db/client.js");
const { addresses, providers } = await import("../src/db/schema.js");
const { buildApp } = await import("../src/app.js");

const app = buildApp();
let seededId: number;

beforeAll(async () => {
  await waitForDb();
  await runMigrations();
  const [a] = await db
    .insert(addresses)
    .values({ locality: "San Francisco", state: "CA", country: "USA" })
    .returning();
  // stored "Last, First M, MD" — the token-matching challenge
  const [p] = await db
    .insert(providers)
    .values({ name: "Scharschmidt, Tiffany C, MD (providers-test)", addressId: a.id })
    .returning();
  seededId = p.id;
});
afterAll(async () => {
  await pool.end();
});

test("GET /providers matches a first-last query against a last-first stored name", async () => {
  const res = await app.request("/providers?name=Tiffany%20Scharschmidt%20MD&city=San%20Francisco&state=CA");
  expect(res.status).toBe(200);
  const body = await res.json();
  const hit = body.providers.find((p: { id: number }) => p.id === seededId);
  expect(hit).toBeTruthy();
  expect(hit.address.locality).toBe("San Francisco");
  // no rank/score fields leak into the response
  expect(hit.score).toBeUndefined();
});

test("GET /providers/:id returns the provider or 404", async () => {
  const ok = await app.request(`/providers/${seededId}`);
  expect(ok.status).toBe(200);
  expect((await ok.json()).id).toBe(seededId);

  const missing = await app.request("/providers/99999999");
  expect(missing.status).toBe(404);
});
