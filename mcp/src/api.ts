export class ApiError extends Error {
  constructor(public status: number, public body: any) {
    super(body?.error ?? `api error ${status}`);
  }
}

const base = () => process.env.API_URL ?? "http://localhost:3000";

async function get(path: string): Promise<any> {
  const res = await fetch(`${base()}${path}`);
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

async function post(path: string, body: unknown): Promise<any> {
  const res = await fetch(`${base()}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

const qs = (o: Record<string, string | number | undefined>) =>
  "?" +
  Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");

export const findCarriers = (name: string, limit = 10, offset = 0) =>
  get(`/carriers${qs({ name, limit, offset })}`);
export const findPlans = (name: string, limit = 10, offset = 0) => get(`/plans${qs({ name, limit, offset })}`);
export const findProviders = (name: string, city?: string, state?: string, limit = 10, offset = 0) =>
  get(`/providers${qs({ name, city, state, limit, offset })}`);
export const saveProvider = (npi: string, city?: string, state?: string) =>
  post(`/providers`, { npi, city, state });
export const searchProvider = (body: {
  carrierId?: number;
  planId?: number;
  planName?: string;
  providerId?: number;
  name?: string;
  location?: string;
  city?: string;
  state?: string;
}) =>
  post(`/providers/explore`, body).catch((e) => {
    if (
      e instanceof ApiError &&
      e.status === 422 &&
      e.body?.error === "missing_inputs" &&
      Array.isArray(e.body.missing)
    )
      return e.body;
    throw e;
  });
export const getSearchStatus = (runId: number) => get(`/providers/explore/${runId}`);
