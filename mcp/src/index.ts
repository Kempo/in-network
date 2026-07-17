import { setGlobalDispatcher, Agent } from "undici";
setGlobalDispatcher(new Agent({ headersTimeout: 0, bodyTimeout: 0 }));

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildServer } from "./server.js";

const transport = new StdioServerTransport();
await buildServer().connect(transport);
