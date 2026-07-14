import { Hono } from "hono";
import { verify } from "../lib/verification.js";
import { ResolveError } from "../lib/errors.js";

export const verifyRoute = new Hono();

verifyRoute.get("/", async (c) => {
  const providerId = Number(c.req.query("providerId"));
  const planId = Number(c.req.query("planId"));
  if (!Number.isInteger(providerId) || !Number.isInteger(planId))
    return c.json({ error: "providerId and planId required" }, 400);
  try {
    return c.json(await verify({ providerId, planId }));
  } catch (e) {
    if (e instanceof ResolveError) return c.json({ error: e.message }, 404);
    throw e;
  }
});
