import { afterEach, expect, test, vi } from "vitest";

vi.mock("../src/lib/verification.js", () => ({ verify: vi.fn() }));
const { verify } = await import("../src/lib/verification.js");
const { ResolveError } = await import("../src/lib/errors.js");
const { buildApp } = await import("../src/app.js");

const app = buildApp();
const get = (qs: string) => app.request(`/verify${qs}`);

afterEach(() => vi.resetAllMocks());

test("found membership → 200 body", async () => {
  vi.mocked(verify).mockResolvedValueOnce({
    found: true,
    status: "in_network",
    source: "cache",
    refreshedAt: new Date(),
  } as never);
  const res = await get("?providerId=1&planId=2");
  expect(res.status).toBe(200);
  expect((await res.json()).status).toBe("in_network");
});

test("unknown id → 404 with message, not 500", async () => {
  vi.mocked(verify).mockRejectedValueOnce(new ResolveError("Unknown plan: 2"));
  const res = await get("?providerId=1&planId=2");
  expect(res.status).toBe(404);
  expect((await res.json()).error).toContain("Unknown plan");
});

test("unexpected error → 500", async () => {
  vi.mocked(verify).mockRejectedValueOnce(new Error("boom"));
  const res = await get("?providerId=1&planId=2");
  expect(res.status).toBe(500);
});

test("missing params → 400", async () => {
  const res = await get("?providerId=1");
  expect(res.status).toBe(400);
});
