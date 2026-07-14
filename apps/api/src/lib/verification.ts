import { and, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "../db/client.js";
import { networkMemberships, plans, providers } from "../db/schema.js";
import { ResolveError } from "./errors.js";

const TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

export type VerifyResult =
  | { found: false }
  | { found: true; status: "in_network" | "out_of_network"; source: "cache"; refreshedAt: Date };

export async function verify(input: { providerId: number; planId: number }): Promise<VerifyResult> {
  const [provider] = await db.select().from(providers).where(eq(providers.id, input.providerId)).limit(1);
  if (!provider) throw new ResolveError(`Unknown provider: ${input.providerId}`);
  const [plan] = await db.select().from(plans).where(eq(plans.id, input.planId)).limit(1);
  if (!plan) throw new ResolveError(`Unknown plan: ${input.planId}`);

  const freshAfter = new Date(Date.now() - TTL_MS);
  const [hit] = await db
    .select()
    .from(networkMemberships)
    .where(
      and(
        eq(networkMemberships.providerId, provider.id),
        or(
          eq(networkMemberships.planId, plan.id),
          and(isNull(networkMemberships.planId), eq(networkMemberships.networkId, plan.networkId)),
        ),
        gt(networkMemberships.refreshedAt, freshAfter),
      ),
    )
    .limit(1);

  if (hit) return { found: true, status: hit.status, source: "cache", refreshedAt: hit.refreshedAt };
  return { found: false };
}
