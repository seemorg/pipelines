import { Hono } from "hono";

import { getUptime } from "../lib/uptime";

const uptimeRoutes = new Hono().basePath("/uptime");

uptimeRoutes.get("/", async (c) => {
  const time = getUptime();
  return c.json({ uptime: time });
});

export default uptimeRoutes;
