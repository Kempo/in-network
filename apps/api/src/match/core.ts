import { sql, type AnyColumn, type SQL } from "drizzle-orm";

const TITLES = new Set(["md", "do", "dr", "np", "pa", "rn", "dds", "dpm", "od", "phd", "mr", "mrs", "ms"]);

/** Split a name into match tokens (lowercase words), dropping titles + single-char initials. */
export function tokenizeName(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !TITLES.has(t));
}

/** Stored text with punctuation stripped (keep spaces) so a token matches "Schar-Schmidt" etc. */
export function normalizedName(col: AnyColumn): SQL {
  return sql`regexp_replace(${col}, '[^a-zA-Z0-9 ]', '', 'g')`;
}
