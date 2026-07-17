import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { networks, plans, providerDirectories, networkMemberships } from "../db/schema.js";
import { callBrowserUse, type Findings } from "./agent.js";
import { createRun, markProcessing, markFinished, markFailed } from "./runs.js";
import { buildExplorePrompt } from "./prompt.js";
import { insertProvider } from "./providers.js";
import { getProviderById } from "../match/provider.js";
import { ResolveError, MissingInputsError } from "./errors.js";
import { verify, type VerifyResult } from "./verification.js";

export type ExploreInput = {
  carrierId?: number;
  planId?: number;
  planName?: string;
  providerId?: number;
  name?: string;
  location?: string;
  city?: string;
  state?: string;
};

const sanitizePlanName = (s: string) => s.trim().replace(/\s+/g, " ");

export type ExploreResult = { runId: number } | VerifyResult;

export async function startExplore(input: ExploreInput): Promise<ExploreResult> {
  let plan: typeof plans.$inferSelect | undefined;
  if (!input.planId && input.planName && input.carrierId !== undefined) {
    const title = sanitizePlanName(input.planName);
    if (title) {
      const [pl] = await db
        .select()
        .from(plans)
        .where(and(eq(plans.carrierId, input.carrierId), eq(plans.title, title)))
        .limit(1);
      if (pl) plan = pl;
    }
  }
  const cachePlanId = input.planId ?? plan?.id;
  if (input.providerId && cachePlanId) {
    const cached = await verify({ providerId: input.providerId, planId: cachePlanId });
    if (cached.found) return cached;
  }

  const { carrierId } = input;
  const location = input.location?.trim();
  if (carrierId === undefined || !location) {
    const missing = [
      ...(carrierId === undefined ? ["carrierId"] : []),
      ...(!location ? ["location"] : []),
    ];
    throw new MissingInputsError(missing);
  }

  const [dir] = await db
    .select()
    .from(providerDirectories)
    .where(eq(providerDirectories.carrierId, carrierId))
    .limit(1);
  if (!dir) throw new ResolveError(`No directory for carrier ${carrierId}`);

  let planTitle: string;
  if (plan) {
    planTitle = plan.title;
  } else if (input.planId) {
    const [pl] = await db.select().from(plans).where(eq(plans.id, input.planId)).limit(1);
    if (!pl) throw new ResolveError(`Unknown plan: ${input.planId}`);
    plan = pl;
    planTitle = pl.title;
  } else if (input.planName && sanitizePlanName(input.planName)) {
    planTitle = sanitizePlanName(input.planName);
  } else {
    throw new ResolveError("planId or planName required");
  }

  let descriptor: { name: string; address?: string };
  if (input.providerId) {
    const match = await getProviderById(input.providerId);
    if (!match) throw new ResolveError(`Unknown provider: ${input.providerId}`);
    descriptor = {
      name: match.provider.name,
      address: [match.address.line1, match.address.locality, match.address.state].filter(Boolean).join(", "),
    };
  } else if (input.name) {
    descriptor = { name: input.name, address: [input.city, input.state].filter(Boolean).join(", ") };
  } else {
    throw new ResolveError("providerId or name required");
  }

  const prompt = buildExplorePrompt({ directoryUrl: dir.url, instructions: dir.instructions, planTitle, location, descriptor });
  const run = await createRun(prompt);
  void runExplore(run.id, input, carrierId, prompt, planTitle, plan);
  return { runId: run.id };
}

async function runExplore(
  runId: number,
  input: ExploreInput,
  carrierId: number,
  prompt: string,
  planTitle: string,
  plan?: typeof plans.$inferSelect
): Promise<void> {
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
    const { planId, networkId } = await resolvePlan(carrierId, planTitle, plan);
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

async function resolvePlan(
  carrierId: number,
  planTitle: string,
  plan?: typeof plans.$inferSelect
): Promise<{ planId: number; networkId: number }> {
  if (plan) return { planId: plan.id, networkId: plan.networkId };
  let [net] = await db
    .select()
    .from(networks)
    .where(and(eq(networks.carrierId, carrierId), eq(networks.title, planTitle)))
    .limit(1);
  if (!net) [net] = await db.insert(networks).values({ title: planTitle, carrierId }).returning();
  let [pl] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.carrierId, carrierId), eq(plans.title, planTitle)))
    .limit(1);
  if (!pl)
    [pl] = await db
      .insert(plans)
      .values({ title: planTitle, carrierId, networkId: net.id })
      .returning();
  return { planId: pl.id, networkId: net.id };
}
