import { beforeEach, expect, test, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ToolListChangedNotificationSchema } from "@modelcontextprotocol/sdk/types.js";

vi.mock("../src/api.js", () => ({
  findCarriers: vi.fn(),
  findPlans: vi.fn(),
  findProviders: vi.fn(),
  saveProvider: vi.fn(),
  searchProvider: vi.fn(),
  getSearchStatus: vi.fn(),
}));

const api = await import("../src/api.js");
const { buildServer } = await import("../src/server.js");

beforeEach(() => {
  vi.clearAllMocks();
});

async function connectedClient() {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = buildServer();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  let listChanged = 0;
  client.setNotificationHandler(ToolListChangedNotificationSchema, () => {
    listChanged++;
  });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, getListChangedCount: () => listChanged };
}

const toolNames = async (client: Client) => (await client.listTools()).tools.map((t) => t.name).sort();

test("initial tool list exposes the always-on tools including search_provider", async () => {
  const { client } = await connectedClient();
  expect(await toolNames(client)).toEqual(["find_carrier", "find_plan", "find_provider", "search_provider"]);
});

test("calling a gated tool before its precondition is rejected by the server, not routed to the handler", async () => {
  const { client } = await connectedClient();
  const res = await client.callTool({ name: "save_provider", arguments: { npi: "123" } });
  expect(res.isError).toBe(true);
  expect((res.content as any)[0].text).toMatch(/disabled/);
  expect(api.saveProvider).not.toHaveBeenCalled();
});

test("npi candidates from find_provider unlock save_provider and fire list_changed", async () => {
  const { client, getListChangedCount } = await connectedClient();
  vi.mocked(api.findProviders).mockResolvedValue({
    providers: [{ npi: "123", name: "Dr. X", source: "npi" }],
  });

  await client.callTool({ name: "find_provider", arguments: { name: "Dr. X" } });

  expect(await toolNames(client)).toContain("save_provider");
  expect(getListChangedCount()).toBeGreaterThan(0);
});

test("search_provider starts a run, unlocks get_search_status, and a terminal status re-hides it", async () => {
  const { client } = await connectedClient();
  vi.mocked(api.searchProvider).mockResolvedValue({ runId: 99 });
  vi.mocked(api.getSearchStatus).mockResolvedValue({
    status: "finished",
    result: { providerId: 1, planId: 2, status: "in_network" },
  });

  await client.callTool({ name: "search_provider", arguments: { providerId: 1, planId: 2 } });
  expect(await toolNames(client)).toContain("get_search_status");

  await client.callTool({ name: "get_search_status", arguments: { runId: 99 } });
  expect(await toolNames(client)).not.toContain("get_search_status");
});

test("search_provider returns a cached answer without tracking a run", async () => {
  const { client } = await connectedClient();
  vi.mocked(api.searchProvider).mockResolvedValue({ found: true, status: "in_network", source: "cache" });

  const res = await client.callTool({ name: "search_provider", arguments: { providerId: 1, planId: 2 } });

  expect(res.isError).toBeFalsy();
  expect(await toolNames(client)).not.toContain("get_search_status");
});

test("search_provider asks for missing inputs instead of starting a run", async () => {
  const { client } = await connectedClient();
  vi.mocked(api.searchProvider).mockResolvedValue({ error: "missing_inputs", missing: ["carrierId", "location"] });

  const res = await client.callTool({ name: "search_provider", arguments: { providerId: 1, planId: 2 } });

  expect(res.isError).toBe(true);
  expect((res.content as any)[0].text).toMatch(/carrierId/);
});

test("search_provider stays usable for a second provider after the first run finishes", async () => {
  const { client } = await connectedClient();
  vi.mocked(api.searchProvider).mockResolvedValue({ runId: 99 });
  vi.mocked(api.getSearchStatus).mockResolvedValue({
    status: "finished",
    result: { providerId: 1, planId: 2, status: "out_of_network" },
  });

  await client.callTool({ name: "search_provider", arguments: { providerId: 1, planId: 2 } }); // provider X
  await client.callTool({ name: "get_search_status", arguments: { runId: 99 } });

  expect(await toolNames(client)).toContain("search_provider");
  const res = await client.callTool({ name: "search_provider", arguments: { providerId: 5, planId: 2 } }); // provider Y
  expect(res.isError).toBeFalsy();
});

test("state does not leak across two servers in one process", async () => {
  const a = await connectedClient();
  vi.mocked(api.findProviders).mockResolvedValue({
    providers: [{ npi: "123", name: "Dr. X", source: "npi" }],
  });
  await a.client.callTool({ name: "find_provider", arguments: { name: "Dr. X" } });
  expect(await toolNames(a.client)).toContain("save_provider");

  const b = await connectedClient();
  expect(await toolNames(b.client)).not.toContain("save_provider");
});
