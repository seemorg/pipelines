import { Hono } from "hono";
import { compress } from "hono/compress";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";

import { env } from "./env";
import routes from "./routes";

if (env.NODE_ENV === "production") {
  await import("./queues/book/book-worker");
  await import("./queues/author/author-worker");
  await import("./queues/regeneration/regeneration-worker");
  await import("./queues/typesense/typesense-worker");
  await import("./queues/ai-indexer/worker");
  await import("./queues/keyword-indexer/worker");
}

const app = new Hono();

app.use(
  secureHeaders({
    crossOriginResourcePolicy: "cross-origin",
  }),
);
app.use(compress());
app.use(cors());

app.route("/", routes);

export default app;
