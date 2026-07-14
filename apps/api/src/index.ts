import { setGlobalDispatcher, Agent } from "undici";

// Browser-use runs can take 15-30+ min; disable undici's 5-min default header/body
// timeouts so the fetch to the agent isn't aborted with UND_ERR_HEADERS_TIMEOUT.
setGlobalDispatcher(new Agent({ headersTimeout: 0, bodyTimeout: 0 }));

import { serve } from "@hono/node-server";
import { waitForDb, runMigrations } from "./db/client.js";
import { buildApp } from "./app.js";

const port = Number(process.env.API_PORT ?? 3000);
await waitForDb();
await runMigrations();
serve({ fetch: buildApp().fetch, port });
console.log(`api listening on :${port}`);
