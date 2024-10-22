import { bookCoversQueue } from "@/queues/book-cover/book-cover-queue";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { z } from "zod";

import { env } from "../env";

const basePath = "/book-covers";
const bookCoversRoutes = new Hono().basePath(basePath);

bookCoversRoutes.use(
  bearerAuth({
    token: env.USUL_PIPELINE_API_KEY,
  }),
);

bookCoversRoutes.post(
  "/regenerate",
  zValidator(
    "json",
    z.object({
      bookId: z.string(),
    }),
  ),
  async (c) => {
    const { bookId } = c.req.valid("json");
    await bookCoversQueue.add(`book_cover_${bookId}`, {
      bookId,
    });

    return c.json({ success: true });
  },
);

export default bookCoversRoutes;
