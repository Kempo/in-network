import { afterEach, expect, test, vi } from "vitest";
import { searchProvider, ApiError } from "../src/api.js";

const mockFetch = (status: number, body: string, contentType = "application/json") =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(body, { status, headers: { "content-type": contentType } })),
  );

afterEach(() => vi.unstubAllGlobals());

test("a 422 missing_inputs body is returned as a normal value", async () => {
  mockFetch(422, JSON.stringify({ error: "missing_inputs", missing: ["carrierId", "location"] }));
  const res = await searchProvider({ providerId: 1, planId: 2 });
  expect(res).toEqual({ error: "missing_inputs", missing: ["carrierId", "location"] });
});

test("a 422 with a non-JSON body rethrows instead of returning {}", async () => {
  mockFetch(422, "Unprocessable Entity", "text/plain");
  await expect(searchProvider({ providerId: 1, planId: 2 })).rejects.toBeInstanceOf(ApiError);
});

test("a 422 with an unexpected JSON shape rethrows", async () => {
  mockFetch(422, JSON.stringify({ error: "validation_failed", fields: ["x"] }));
  await expect(searchProvider({ providerId: 1, planId: 2 })).rejects.toBeInstanceOf(ApiError);
});

test("a 422 missing_inputs without a missing array rethrows", async () => {
  mockFetch(422, JSON.stringify({ error: "missing_inputs" }));
  await expect(searchProvider({ providerId: 1, planId: 2 })).rejects.toBeInstanceOf(ApiError);
});
