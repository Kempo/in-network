import { and, eq, ilike, desc, type SQL } from "drizzle-orm";
import { db } from "../db/client.js";
import { providers, addresses } from "../db/schema.js";
import { tokenizeName, normalizedName } from "./core.js";

type Provider = typeof providers.$inferSelect;
type Address = typeof addresses.$inferSelect;
export type ProviderMatch = { provider: Provider; address: Address };

export async function searchProviders(input: {
  name?: string;
  city?: string;
  state?: string;
  limit: number;
  offset: number;
}): Promise<ProviderMatch[]> {
  const norm = normalizedName(providers.name);
  const conds: SQL[] = [];
  if (input.name) for (const t of tokenizeName(input.name)) conds.push(ilike(norm, `%${t}%`));
  if (input.city) conds.push(ilike(addresses.locality, `%${input.city}%`));
  if (input.state) conds.push(ilike(addresses.state, `%${input.state}%`));
  return db
    .select({ provider: providers, address: addresses })
    .from(providers)
    .innerJoin(addresses, eq(providers.addressId, addresses.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(providers.id))
    .limit(input.limit)
    .offset(input.offset);
}

export async function getProviderById(id: number): Promise<ProviderMatch | null> {
  const [row] = await db
    .select({ provider: providers, address: addresses })
    .from(providers)
    .innerJoin(addresses, eq(providers.addressId, addresses.id))
    .where(eq(providers.id, id))
    .limit(1);
  return row ?? null;
}
