import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { searchProviders, getProviderById, type ProviderMatch } from "../match/provider.js";
import { pageParams } from "../lib/page.js";
import { startExplore } from "../lib/explore.js";
import { searchNpi, type NpiProvider } from "../lib/npi.js";
import { saveProviderByNpi } from "../lib/providers.js";
import { ResolveError } from "../lib/errors.js";
import { db } from "../db/client.js";
import { agentRuns } from "../db/schema.js";

export const providersRoute = new Hono();

const shape = (m: ProviderMatch) => ({ ...m.provider, address: m.address, source: "db" as const });
// Registry candidate: no id (not persisted) until the user picks it via POST /providers.
const shapeNpi = (p: NpiProvider) => ({
  name: p.name,
  specialty: p.specialty,
  npi: p.npi,
  address: { line1: p.line1, locality: p.locality, state: p.state, zip: p.zip },
  source: "npi" as const,
});

providersRoute.get("/", async (c) => {
  const { limit, offset } = pageParams(c.req.query());
  const name = c.req.query("name");
  const city = c.req.query("city");
  const state = c.req.query("state");
  const matches = await searchProviders({ name, city, state, limit, offset });
  // Nothing on file — fall back to the NPI registry so unknown providers can be found.
  if (matches.length === 0 && name) {
    const candidates = await searchNpi({ name, city, state });
    return c.json({ providers: candidates.map(shapeNpi), limit, offset });
  }
  return c.json({ providers: matches.map(shape), limit, offset });
});

providersRoute.post("/", async (c) => {
  const { npi, city, state } = await c.req.json().catch(() => ({}));
  if (typeof npi !== "string" || !npi.trim()) return c.json({ error: "npi required" }, 400);
  try {
    return c.json({ provider: await saveProviderByNpi(npi.trim(), { city, state }) }, 201);
  } catch (e) {
    if (e instanceof ResolveError) return c.json({ error: e.message }, 400);
    throw e;
  }
});

providersRoute.post("/explore", async (c) => {
  const body = await c.req.json();
  try {
    return c.json(await startExplore(body), 202);
  } catch (e) {
    if (e instanceof ResolveError) return c.json({ error: e.message }, 400);
    throw e;
  }
});

providersRoute.get("/explore/:runId", async (c) => {
  const id = Number(c.req.param("runId"));
  if (!Number.isInteger(id)) return c.json({ error: "invalid runId" }, 400);
  const [run] = await db.select().from(agentRuns).where(eq(agentRuns.id, id)).limit(1);
  if (!run) return c.json({ error: "unknown run" }, 404);
  return c.json({ status: run.status, result: run.result, error: run.error });
});

providersRoute.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "invalid id" }, 400);
  const match = await getProviderById(id);
  if (!match) return c.json({ error: "provider not found" }, 404);
  return c.json(shape(match));
});
