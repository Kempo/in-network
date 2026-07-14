import { Hono } from "hono";
import { searchCarriers } from "../match/carrier.js";
import { pageParams } from "../lib/page.js";

export const carriersRoute = new Hono();

carriersRoute.get("/", async (c) => {
  const { limit, offset } = pageParams(c.req.query());
  const carriers = await searchCarriers({ name: c.req.query("name"), limit, offset });
  return c.json({ carriers, limit, offset });
});
