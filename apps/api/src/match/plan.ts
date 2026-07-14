import { and, ilike } from "drizzle-orm";
import { db } from "../db/client.js";
import { plans } from "../db/schema.js";
import { tokenizeName, normalizedName } from "./core.js";

type Plan = typeof plans.$inferSelect;

export async function searchPlans(input: {
  name?: string;
  limit: number;
  offset: number;
}): Promise<Plan[]> {
  const norm = normalizedName(plans.title);
  const conds = input.name ? tokenizeName(input.name).map((t) => ilike(norm, `%${t}%`)) : [];
  return db
    .select()
    .from(plans)
    .where(conds.length ? and(...conds) : undefined)
    .limit(input.limit)
    .offset(input.offset);
}
