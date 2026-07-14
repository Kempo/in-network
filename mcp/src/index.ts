import { setGlobalDispatcher, Agent } from "undici";
setGlobalDispatcher(new Agent({ headersTimeout: 0, bodyTimeout: 0 }));

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as api from "./api.js";

const server = new McpServer(
  { name: "in-network-mcp", version: "0.2.0" },
  {
    instructions:
      "Goal: Help check whether a provider is in their insurance plan and network. " +
      "NEVER expose internal mechanics to the user: no mention of a 'database', 'cache', " +
      "'run'/'runId', 'directory search', 'membership record', 'polling', or tool names. " +
      "Speak in the user's terms — 'plan', 'carrier', 'provider', 'network'. If a provider " +
      "isn't on file, don't explain why; just ask for what you need (carrier, plan, location) " +
      "and note the check may take a minute once you have it.",
  },
);
const text = (v: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(v) }] });

server.registerTool(
  "find_carrier",
  {
    title: "Find Carrier",
    description:
      "Search known insurance carriers by name; returns candidates with ids. If the user hasn't named a carrier and you need one (e.g. for search_provider), ASK the user rather than guessing.",
    inputSchema: { name: z.string().describe("Carrier name, e.g. 'Blue Shield of California'") },
  },
  async ({ name }) => text(await api.findCarriers(name)),
);

server.registerTool(
  "find_provider",
  {
    title: "Find Provider",
    description:
      "Search providers by name (+ optional city/state). Returns providers already on file OR, when none are on file, candidate providers to choose from (each with an npi but NO id, source 'npi'). Ask the user for a provider name if none was given. If candidates come back, present them and let the user pick, then call save_provider with the chosen npi to get an id.",
    inputSchema: {
      name: z.string().describe("Provider/facility name"),
      city: z.string().optional(),
      state: z.string().optional(),
    },
  },
  async ({ name, city, state }) => text(await api.findProviders(name, city, state)),
);

server.registerTool(
  "save_provider",
  {
    title: "Save Provider",
    description:
      "Save the provider the user chose from find_provider candidates (by npi) so it can be checked against a plan. Also pass the chosen candidate's city/state (its address.locality and address.state) so the correct practice location is saved — a provider can list several addresses. Returns the saved provider with its id — use that id for check_provider_plan / search_provider.",
    inputSchema: {
      npi: z.string().describe("The npi of the chosen find_provider candidate"),
      city: z.string().optional().describe("The chosen candidate's address.locality"),
      state: z.string().optional().describe("The chosen candidate's address.state"),
    },
  },
  async ({ npi, city, state }) => text(await api.saveProvider(npi, city, state)),
);

server.registerTool(
  "find_plan",
  {
    title: "Find Plan",
    description: "Search plans already on file by name.",
    inputSchema: { name: z.string().describe("Plan name, e.g. 'Gold 80 Trio HMO'") },
  },
  async ({ name }) => text(await api.findPlans(name)),
);

server.registerTool(
  "check_provider_plan",
  {
    title: "Check Provider In Plan",
    description:
      "Check the status we already have on file for a KNOWN providerId + planId. Returns {found:false} when there is no fresh answer on file — then use search_provider to look it up with the insurer.",
    inputSchema: { providerId: z.number(), planId: z.number() },
  },
  async ({ providerId, planId }) => text(await api.checkProviderPlan(providerId, planId)),
);

server.registerTool(
  "search_provider",
  {
    title: "Search Provider Online",
    description:
      "Look up a provider with the insurer and save the result. Requires carrierId (use find_carrier; ASK the user if unknown), a plan reference (planId when find_plan matched, otherwise planName), and a location to search (ASK the user if not given). Provide providerId if find_provider matched, else name (+city/state). Returns {runId}; poll get_search_status until finished.",
    inputSchema: {
      carrierId: z.number(),
      planId: z.number().optional(),
      planName: z.string().optional(),
      providerId: z.number().optional(),
      name: z.string().optional(),
      location: z
        .string()
        .describe("Where to search the directory: a ZIP like '94102' or 'City, ST'. ASK the user if not provided."),
      city: z.string().optional(),
      state: z.string().optional(),
    },
  },
  async (args) => text(await api.searchProvider(args)),
);

server.registerTool(
  "get_search_status",
  {
    title: "Get Search Status",
    description:
      "Waits up to ~25s for a search_provider run by runId. Terminal states are 'finished' and 'failed'; result carries {providerId, planId, status} when finished. If it returns 'processing', call again with the same runId — do NOT sleep or write a script.",
    inputSchema: { runId: z.number() },
  },
  async ({ runId }) => {
    const deadline = Date.now() + 25_000;
    while (true) {
      const s = await api.getSearchStatus(runId);
      if (s.status === "finished" || s.status === "failed" || Date.now() > deadline) return text(s);
      await new Promise((r) => setTimeout(r, 1000));
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
