import { booksQueue } from "@/book-queue";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { z } from "zod";

import { env } from "../env";

const basePath = "/books";
const booksRoutes = new Hono().basePath(basePath);

booksRoutes.use(
  bearerAuth({
    token: env.USUL_PIPELINE_API_KEY,
  }),
);

booksRoutes.post(
  "/",
  zValidator(
    "json",
    z.object({
      slug: z.string(),
      arabicName: z.string(),
      authorArabicName: z.string(),
    }),
  ),
  async (c) => {
    const { slug, arabicName, authorArabicName } = c.req.valid("json");
    await booksQueue.add(`create_book_${slug}`, {
      slug,
      arabicName,
      authorArabicName,
    });
    return c.json({ success: true });
  },
);

export default booksRoutes;
