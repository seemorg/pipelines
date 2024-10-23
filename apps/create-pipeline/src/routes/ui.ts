import { authorsQueue } from "@/queues/author/author-queue";
import { bookCoversQueue } from "@/queues/book-cover/book-cover-queue";
import { booksQueue } from "@/queues/book/book-queue";
import { regenerationQueue } from "@/queues/regeneration/regeneration-queue";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/dist/src/queueAdapters/bullMQ.js";
import { HonoAdapter } from "@bull-board/hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";

import { env } from "../env";

const basePath = "/ui";
const uiRoutes = new Hono().basePath(basePath);

uiRoutes.use(
  basicAuth({
    username: env.DASHBOARD_USERNAME,
    password: env.DASHBOARD_PASSWORD,
  }),
);

const serverAdapter = new HonoAdapter(serveStatic).setBasePath(basePath);

createBullBoard({
  queues: [
    new BullMQAdapter(booksQueue),
    new BullMQAdapter(authorsQueue),
    new BullMQAdapter(bookCoversQueue),
    new BullMQAdapter(regenerationQueue),
  ],
  serverAdapter,
});

uiRoutes.route("/", serverAdapter.registerPlugin());

export default uiRoutes;
