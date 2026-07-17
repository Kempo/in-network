import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as api from "./api.js";
import { createState, isTerminal } from "./state.js";

const text = (v: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(v) }] });

export function buildServer() {
  const server = new McpServer(
    { name: "in-network-mcp", version: "0.2.0" },
    {
      instructions:
        "Goal: Help check whether a provider is in their insurance plan and network. " +
        "NEVER expose internal mechanics to the user: no mention of a 'database', 'cache', " +
        "'run'/'runId', 'directory search', 'membership record', 'polling', or tool names. " +
        "Speak in the user's terms — 'plan', 'carrier', 'provider', 'network'. If a provider " +
        "isn't on file, don't explain why; just ask for what you need (carrier, plan, location) " +
        "and note the check may take a minute once you have it. When only one candidate/match " +
        "comes back (e.g. a single carrier, plan, or provider), don't present it as a multiple-" +
        "choice question — state it directly and confirm ('Is this your plan: X?') or just " +
        "proceed with it.",
    },
  );

  const s = createState();
  const tools: Record<string, ReturnType<typeof server.registerTool>> = {};

  const syncTools = () => {
    for (const [tool, canRun] of [
      [tools.save_provider, s.canSaveProvider],
      [tools.get_search_status, s.canGetSearchStatus],
    ] as const) {
      const shouldEnable = canRun();
      if (tool.enabled !== shouldEnable) shouldEnable ? tool.enable() : tool.disable();
    }
  };

  tools.find_carrier = server.registerTool(
    "find_carrier",
    {
      title: "Find Carrier",
      description:
        "Search known insurance carriers by name; returns candidates with ids. If the user hasn't named a carrier and you need one (e.g. for search_provider), ASK the user rather than guessing.",
      inputSchema: { name: z.string().describe("Carrier name, e.g. 'Blue Shield of California'") },
    },
    async ({ name }) => text(await api.findCarriers(name)),
  );

  tools.find_provider = server.registerTool(
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
    async ({ name, city, state }) => {
      const res = await api.findProviders(name, city, state);
      s.recordProviderSearch(res);
      syncTools();
      return text(res);
    },
  );

  tools.save_provider = server.registerTool(
    "save_provider",
    {
      title: "Save Provider",
      description:
        "Save the provider the user chose from find_provider candidates (by npi) so it can be checked against a plan (only available after find_provider returns candidates). Also pass the chosen candidate's city/state (its address.locality and address.state) so the correct practice location is saved — a provider can list several addresses. Returns the saved provider with its id — use that id for search_provider.",
      inputSchema: {
        npi: z.string().describe("The npi of the chosen find_provider candidate"),
        city: z.string().optional().describe("The chosen candidate's address.locality"),
        state: z.string().optional().describe("The chosen candidate's address.state"),
      },
    },
    async ({ npi, city, state }) => text(await api.saveProvider(npi, city, state)),
  );

  tools.find_plan = server.registerTool(
    "find_plan",
    {
      title: "Find Plan",
      description: "Search plans already on file by name.",
      inputSchema: { name: z.string().describe("Plan name, e.g. 'Gold 80 Trio HMO'") },
    },
    async ({ name }) => text(await api.findPlans(name)),
  );

  tools.search_provider = server.registerTool(
    "search_provider",
    {
      title: "Check Provider Coverage",
      description:
        "The one tool to get a coverage answer for a provider in a plan. Checks what's already on file first and returns the answer immediately when available. Only when nothing is on file does it need carrierId (from find_carrier) and a location to look it up — if those are missing it returns which ones to ask the user for. Provide providerId (from find_provider/save_provider) or name (+city/state), and planId (from find_plan) or planName. Returns the answer directly, or {runId} to poll with get_search_status.",
      inputSchema: {
        carrierId: z.number().optional(),
        planId: z.number().optional(),
        planName: z.string().optional(),
        providerId: z.number().optional(),
        name: z.string().optional(),
        location: z
          .string()
          .optional()
          .describe("Where to search if a lookup is needed: a ZIP like '94102' or 'City, ST'."),
        city: z.string().optional(),
        state: z.string().optional(),
      },
    },
    async (args) => {
      const res = await api.searchProvider(args);
      if (res?.error === "missing_inputs") {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text:
                `Before this can be looked up, provide: ${res.missing.join(", ")}. ` +
                "Get carrierId from find_carrier and ask the user for a location (ZIP or 'City, ST'), then call search_provider again.",
            },
          ],
        };
      }
      if ("runId" in res) {
        s.recordSearchStarted(res);
        syncTools();
      }
      return text(res);
    },
  );

  tools.get_search_status = server.registerTool(
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
        const res = await api.getSearchStatus(runId);
        if (isTerminal(res.status) || Date.now() > deadline) {
          s.recordSearchStatus(runId, res);
          syncTools();
          return text(res);
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
    },
  );

  syncTools();
  return server;
}
