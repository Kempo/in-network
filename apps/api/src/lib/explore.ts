import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { addresses, networks, plans, providers, providerDirectories, networkMemberships } from "../db/schema.js";
import { callBrowserUse, type Findings } from "./agent.js";
import { createRun, markProcessing, markFinished, markFailed } from "./runs.js";
import { buildExplorePrompt } from "./prompt.js";
import { insertProvider } from "./providers.js";
import { ResolveError } from "./errors.js";

export type ExploreInput = {
  carrierId: number;
  planId?: number;
  planName?: string;
  providerId?: number;
  name?: string;
  location: string;
  city?: string;
  state?: string;
};

const sanitizePlanName = (s: string) => s.trim().replace(/\s+/g, " ");

export async function startExplore(input: ExploreInput): Promise<{ runId: number }> {
  const location = input.location?.trim();
  if (!location) throw new ResolveError("location required");

  const [dir] = await db
    .select()
    .from(providerDirectories)
    .where(eq(providerDirectories.carrierId, input.carrierId))
    .limit(1);
  if (!dir) throw new ResolveError(`No directory for carrier ${input.carrierId}`);

  let planTitle: string;
  if (input.planId) {
    const [pl] = await db.select().from(plans).where(eq(plans.id, input.planId)).limit(1);
    if (!pl) throw new ResolveError(`Unknown plan: ${input.planId}`);
    planTitle = pl.title;
  } else if (input.planName && sanitizePlanName(input.planName)) {
    planTitle = sanitizePlanName(input.planName);
  } else {
    throw new ResolveError("planId or planName required");
  }

  let descriptor: { name: string; address?: string };
  if (input.providerId) {
    const [row] = await db
      .select({ p: providers, a: addresses })
      .from(providers)
      .innerJoin(addresses, eq(providers.addressId, addresses.id))
      .where(eq(providers.id, input.providerId))
      .limit(1);
    if (!row) throw new ResolveError(`Unknown provider: ${input.providerId}`);
    descriptor = { name: row.p.name, address: [row.a.line1, row.a.locality, row.a.state].filter(Boolean).join(", ") };
  } else if (input.name) {
    descriptor = { name: input.name, address: [input.city, input.state].filter(Boolean).join(", ") };
  } else {
    throw new ResolveError("providerId or name required");
  }

  const prompt = buildExplorePrompt({ directoryUrl: dir.url, instructions: dir.instructions, planTitle, location, descriptor });
  const run = await createRun(prompt);
  void runExplore(run.id, input, prompt, planTitle);
  return { runId: run.id };
}

async function runExplore(runId: number, input: ExploreInput, prompt: string, planTitle: string): Promise<void> {
  await markProcessing(runId);
  let findings: Findings;
  try {
    findings = await callBrowserUse({ prompt });
  } catch (e) {
    await markFailed(runId, e instanceof Error ? e.message : String(e));
    return;
  }
  if (findings.status === "inconclusive") {
    // Directory returned an error page (not a real "no match"): surface "couldn't
    // verify" instead of persisting a wrong in/out membership.
    await markFailed(runId, "could not verify network status: directory search error");
    return;
  }
  try {
    const providerId =
      input.providerId ??
      (
        await insertProvider({
          name: findings.provider.name,
          npi: findings.provider.npi,
          line1: findings.provider.address,
          locality: findings.provider.city,
          state: findings.provider.state,
        })
      ).id;
    const { planId, networkId } = await resolvePlan(input, planTitle);
    const now = new Date();
    await db
      .insert(networkMemberships)
      .values({
        status: findings.status,
        planId: findings.scope_hint === "plan_specific" ? planId : null,
        providerId,
        networkId,
        refreshedAt: now,
      })
      .onConflictDoUpdate({
        target: [networkMemberships.providerId, networkMemberships.networkId, networkMemberships.planId],
        set: { status: findings.status, refreshedAt: now },
      });
    await markFinished(runId, { providerId, planId, status: findings.status });
  } catch (e) {
    await markFailed(runId, e instanceof Error ? e.message : String(e));
  }
}

async function resolvePlan(input: ExploreInput, planTitle: string): Promise<{ planId: number; networkId: number }> {
  if (input.planId) {
    const [pl] = await db.select().from(plans).where(eq(plans.id, input.planId)).limit(1);
    return { planId: pl.id, networkId: pl.networkId };
  }
  let [net] = await db
    .select()
    .from(networks)
    .where(and(eq(networks.carrierId, input.carrierId), eq(networks.title, planTitle)))
    .limit(1);
  if (!net) [net] = await db.insert(networks).values({ title: planTitle, carrierId: input.carrierId }).returning();
  let [pl] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.carrierId, input.carrierId), eq(plans.title, planTitle)))
    .limit(1);
  if (!pl)
    [pl] = await db
      .insert(plans)
      .values({ title: planTitle, carrierId: input.carrierId, networkId: net.id })
      .returning();
  return { planId: pl.id, networkId: net.id };
}
