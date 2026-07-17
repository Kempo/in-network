import { Hono } from "hono";
import { carriersRoute } from "./routes/carriers.js";
import { plansRoute } from "./routes/plans.js";
import { providersRoute } from "./routes/providers.js";

export function buildApp() {
  const app = new Hono();
  app.get("/health", (c) => c.json({ ok: true }));
  app.route("/carriers", carriersRoute);
  app.route("/plans", plansRoute);
  app.route("/providers", providersRoute);
  return app;
}
