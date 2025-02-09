import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/dist/src/queueAdapters/bullMQ.js";
import { HonoAdapter } from "@bull-board/hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";

import { env } from "../env";
import { aiIndexerQueue } from "../queues/ai-indexer/queue";
import { authorsQueue } from "../queues/author/queue";
import { booksQueue } from "../queues/book/queue";
import { keywordIndexerQueue } from "../queues/keyword-indexer/queue";
import { regenerationQueue } from "../queues/regeneration/queue";
import { typesenseQueue } from "../queues/typesense/queue";

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
    new BullMQAdapter(aiIndexerQueue),
    new BullMQAdapter(keywordIndexerQueue),
    new BullMQAdapter(typesenseQueue),
    new BullMQAdapter(regenerationQueue),
    new BullMQAdapter(booksQueue),
    new BullMQAdapter(authorsQueue),
  ],
  serverAdapter,
});

uiRoutes.route("/", serverAdapter.registerPlugin());

export default uiRoutes;
