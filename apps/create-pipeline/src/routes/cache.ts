import { purgeAllCloudflareCache } from "@/lib/cloudflare";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";

import { env } from "../env";

const basePath = "/cache";
const cacheRoutes = new Hono().basePath(basePath);

cacheRoutes.use(
  bearerAuth({
    token: env.USUL_PIPELINE_API_KEY,
  }),
);

cacheRoutes.post("/purge", async (c) => {
  const success = await purgeAllCloudflareCache();
  return c.json({ success });
});

export default cacheRoutes;
