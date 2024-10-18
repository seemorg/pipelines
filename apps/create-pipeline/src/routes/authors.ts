import { authorsQueue } from "@/author-queue";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { z } from "zod";

import { env } from "../env";

const basePath = "/authors";
const authorsRoutes = new Hono().basePath(basePath);

authorsRoutes.use(
  bearerAuth({
    token: env.USUL_PIPELINE_API_KEY,
  }),
);

authorsRoutes.post(
  "/",
  zValidator(
    "json",
    z.object({
      slug: z.string(),
      arabicName: z.string(),
    }),
  ),
  async (c) => {
    const { slug, arabicName } = c.req.valid("json");
    await authorsQueue.add(`create_author_${slug}`, { slug, arabicName });
    return c.json({ success: true });
  },
);

export default authorsRoutes;
