import { authorsQueue } from "@/queues/author/author-queue";
import { regenerationQueue } from "@/queues/regeneration/regeneration-queue";
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

authorsRoutes.post(
  "/regenerate",
  zValidator(
    "json",
    z.object({
      id: z.string(),
      regenerateBio: z.boolean().optional(),
      regenerateNames: z.boolean().optional(),
    }),
  ),
  async (c) => {
    const { id, regenerateBio, regenerateNames } = c.req.valid("json");
    await regenerationQueue.add(`regenerate_author_${id}`, {
      type: "author",
      id,
      regenerateBio,
      regenerateNames,
    });

    return c.json({ success: true });
  },
);

export default authorsRoutes;
