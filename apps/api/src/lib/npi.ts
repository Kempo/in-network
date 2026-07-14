import { ResolveError } from "./errors.js";

// CMS National Provider Identifier registry — public, no auth.
// https://npiregistry.cms.hhs.gov/api-page
const BASE = "https://npiregistry.cms.hhs.gov/api/?version=2.1";

export type NpiProvider = {
  npi: string;
  name: string;
  specialty: string | null;
  line1: string | null;
  locality: string | null;
  state: string | null;
  zip: string | null;
};

type RawResult = {
  number: number | string;
  basic?: { first_name?: string; last_name?: string; organization_name?: string };
  addresses?: Array<{ address_purpose?: string; address_1?: string; city?: string; state?: string; postal_code?: string }>;
  taxonomies?: Array<{ desc?: string; primary?: boolean }>;
};

type AddrPref = { city?: string; state?: string };

// Registry addresses are self-reported and the LOCATION/MAILING labels are
// unreliable (a practice address is often filed as MAILING). So when the caller
// asked about a city/state, prefer the address that matches it; otherwise fall
// back to the practice location, then whatever address is present.
function pickAddress(addrs: NonNullable<RawResult["addresses"]>, pref?: AddrPref) {
  const eq = (a?: string, b?: string) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
  if (pref?.city || pref?.state) {
    const match = addrs.find((a) => (!pref.city || eq(a.city, pref.city)) && (!pref.state || eq(a.state, pref.state)));
    if (match) return match;
  }
  return addrs.find((a) => a.address_purpose === "LOCATION") ?? addrs[0];
}

function normalize(r: RawResult, pref?: AddrPref): NpiProvider {
  const b = r.basic ?? {};
  const name = b.organization_name?.trim() || [b.first_name, b.last_name].filter(Boolean).join(" ").trim();
  const addr = pickAddress(r.addresses ?? [], pref);
  const tax = (r.taxonomies ?? []).find((t) => t.primary) ?? (r.taxonomies ?? [])[0];
  return {
    npi: String(r.number),
    name,
    specialty: tax?.desc ?? null,
    line1: addr?.address_1 ?? null,
    locality: addr?.city ?? null,
    state: addr?.state ?? null,
    zip: addr?.postal_code ?? null,
  };
}

async function query(params: Record<string, string | undefined>, pref?: AddrPref): Promise<NpiProvider[]> {
  const qs = Object.entries(params)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`)
    .join("&");
  const res = await fetch(`${BASE}&${qs}`);
  if (!res.ok) throw new Error(`npi registry error ${res.status}`);
  const body = (await res.json()) as { results?: RawResult[] };
  return (body.results ?? []).map((r) => normalize(r, pref)).filter((p) => p.name);
}

// Individual-provider search (first/last from the name). Organizations resolve
// by npi via getNpiByNumber; a free-text name search targets individuals.
export async function searchNpi(input: { name: string; city?: string; state?: string; limit?: number }): Promise<NpiProvider[]> {
  const tokens = input.name.trim().split(/\s+/);
  const first = tokens.length > 1 ? tokens[0] : undefined;
  const last = tokens.length > 1 ? tokens[tokens.length - 1] : tokens[0];
  const pref = { city: input.city, state: input.state };
  return query({ first_name: first, last_name: last, city: input.city, state: input.state, limit: String(input.limit ?? 10) }, pref);
}

export async function getNpiByNumber(npi: string, pref?: { city?: string; state?: string }): Promise<NpiProvider> {
  const [hit] = await query({ number: npi }, pref);
  if (!hit) throw new ResolveError(`No provider found for NPI ${npi}`);
  return hit;
}
