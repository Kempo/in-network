import { and, ilike, type SQL } from "drizzle-orm";
import { db } from "../db/client.js";
import { carriers, type Carrier } from "../db/schema.js";
import { tokenizeName, normalizedName } from "./core.js";

export async function searchCarriers(input: {
  name?: string;
  limit: number;
  offset: number;
}): Promise<Carrier[]> {
  const norm = normalizedName(carriers.name);
  const conds: SQL[] = input.name ? tokenizeName(input.name).map((t) => ilike(norm, `%${t}%`)) : [];
  return db
    .select()
    .from(carriers)
    .where(conds.length ? and(...conds) : undefined)
    .limit(input.limit)
    .offset(input.offset);
}
