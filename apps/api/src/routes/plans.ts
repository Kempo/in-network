import { Hono } from "hono";
import { searchPlans } from "../match/plan.js";
import { pageParams } from "../lib/page.js";

export const plansRoute = new Hono();

plansRoute.get("/", async (c) => {
  const { limit, offset } = pageParams(c.req.query());
  const plans = await searchPlans({ name: c.req.query("name"), limit, offset });
  return c.json({ plans, limit, offset });
});
