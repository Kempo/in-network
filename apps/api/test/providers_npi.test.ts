import { beforeAll, afterAll, afterEach, expect, test, vi } from "vitest";
import { config } from "dotenv";
config({ path: "../../.env" });

const { db, pool, waitForDb, runMigrations } = await import("../src/db/client.js");
const { providers } = await import("../src/db/schema.js");
const { buildApp } = await import("../src/app.js");
const { eq } = await import("drizzle-orm");

const app = buildApp();

// Intercept the NPI registry fetch; fail loudly on any other outbound call.
function mockNpi(result: unknown) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (url: string | URL | Request) => {
    const u = String(url);
    if (u.includes("npiregistry")) return new Response(JSON.stringify(result), { status: 200 });
    throw new Error(`unexpected fetch: ${u}`);
  });
}

const npiResult = (number: string, first: string, last: string, desc: string) => ({
  results: [
    {
      number,
      basic: { first_name: first, last_name: last },
      addresses: [{ address_purpose: "LOCATION", address_1: "1 Main St", city: "Princeton", state: "NJ", postal_code: "08540" }],
      taxonomies: [{ desc, primary: true }],
    },
  ],
});

// A provider whose practice (LOCATION) address and requested city differ: the
// LOCATION is in CT while the SF address is only a MAILING address.
const twoAddrResult = (number: string, last = "Songunlikely") => ({
  results: [
    {
      number,
      basic: { first_name: "Eunice", last_name: last },
      addresses: [
        { address_purpose: "LOCATION", address_1: "160 Robbins St", city: "WATERBURY", state: "CT", postal_code: "067082652" },
        { address_purpose: "MAILING", address_1: "2211 Post St", city: "SAN FRANCISCO", state: "CA", postal_code: "941153442" },
      ],
      taxonomies: [{ desc: "Dermatology", primary: true }],
    },
  ],
});

beforeAll(async () => {
  await waitForDb();
  await runMigrations();
});
afterAll(async () => {
  await pool.end();
});
afterEach(() => {
  vi.restoreAllMocks();
});

test("GET /providers falls back to the NPI registry when nothing is on file", async () => {
  mockNpi(npiResult("1234567893", "Gregory", "Houseunlikely", "Internal Medicine"));
  const res = await app.request("/providers?name=Gregory%20Houseunlikely");
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.providers).toHaveLength(1);
  const hit = body.providers[0];
  expect(hit.source).toBe("npi");
  expect(hit.npi).toBe("1234567893");
  expect(hit.specialty).toBe("Internal Medicine");
  expect(hit.id).toBeUndefined(); // not persisted yet
});

test("POST /providers saves the chosen NPI provider once (idempotent)", async () => {
  mockNpi(npiResult("1234567894", "Lisa", "Cuddyunlikely", "Endocrinology"));

  const r1 = await app.request("/providers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ npi: "1234567894" }),
  });
  expect(r1.status).toBe(201);
  const p1 = (await r1.json()).provider;
  expect(p1.id).toBeTruthy();
  expect(p1.npi).toBe("1234567894");
  expect(p1.specialty).toBe("Endocrinology");

  // Picking the same candidate again returns the same row, no duplicate.
  const r2 = await app.request("/providers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ npi: "1234567894" }),
  });
  expect(r2.status).toBe(201);
  const p2 = (await r2.json()).provider;
  expect(p2.id).toBe(p1.id);

  const rows = await db.select().from(providers).where(eq(providers.npi, "1234567894"));
  expect(rows).toHaveLength(1);
});

// The GET fallback fires only when nothing is on file, so keep this name out of
// the shared dev db (also purges rows left by earlier iterations of these tests).
async function clearSongunlikely() {
  await db.delete(providers).where(eq(providers.name, "Eunice Songunlikely"));
}

test("GET /providers picks the address matching the requested city/state", async () => {
  await clearSongunlikely();
  mockNpi(twoAddrResult("1487018016"));
  const res = await app.request("/providers?name=Eunice%20Songunlikely&city=San%20Francisco&state=CA");
  expect(res.status).toBe(200);
  const hit = (await res.json()).providers[0];
  expect(hit.address.locality).toBe("SAN FRANCISCO");
  expect(hit.address.state).toBe("CA");
});

test("GET /providers falls back to the LOCATION address when no city/state given", async () => {
  await clearSongunlikely();
  mockNpi(twoAddrResult("1487018016"));
  const res = await app.request("/providers?name=Eunice%20Songunlikely");
  expect(res.status).toBe(200);
  const hit = (await res.json()).providers[0];
  expect(hit.address.locality).toBe("WATERBURY");
});

test("POST /providers stores the address matching the requested city/state", async () => {
  await db.delete(providers).where(eq(providers.npi, "1487018017")); // repeatable against the shared dev db
  mockNpi(twoAddrResult("1487018017", "Songsaveonly")); // distinct name so GET fallback tests never match this persisted row
  const r = await app.request("/providers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ npi: "1487018017", city: "San Francisco", state: "CA" }),
  });
  expect(r.status).toBe(201);
  const saved = (await r.json()).provider;
  const detail = await (await app.request(`/providers/${saved.id}`)).json();
  expect(detail.address.locality).toBe("SAN FRANCISCO");
});

test("POST /providers requires an npi", async () => {
  const res = await app.request("/providers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  expect(res.status).toBe(400);
});
