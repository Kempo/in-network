import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { addresses, providers, type Provider } from "../db/schema.js";
import { getNpiByNumber } from "./npi.js";

export type NewProvider = {
  name: string;
  npi?: string | null;
  specialty?: string | null;
  line1?: string | null;
  locality?: string | null;
  state?: string | null;
  zip?: string | null;
};

// Persist a provider and its address as one unit. Shared by the NPI-registry
// and browser-explore flows so the two-insert pattern lives in one place.
export async function insertProvider(p: NewProvider): Promise<Provider> {
  const [addr] = await db
    .insert(addresses)
    .values({ line1: p.line1, locality: p.locality, state: p.state, zip: p.zip, country: "USA" })
    .returning();
  const [row] = await db
    .insert(providers)
    .values({ name: p.name, specialty: p.specialty ?? null, npi: p.npi ?? null, addressId: addr.id })
    .returning();
  return row;
}

// Resolve a provider from the NPI registry and persist it. Dedupes on npi so
// picking the same candidate twice returns the existing row instead of a dup.
export async function saveProviderByNpi(npi: string, pref?: { city?: string; state?: string }): Promise<Provider> {
  const [existing] = await db.select().from(providers).where(eq(providers.npi, npi)).limit(1);
  if (existing) return existing;
  return insertProvider(await getNpiByNumber(npi, pref));
}
