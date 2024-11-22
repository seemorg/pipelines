import { Hono } from "hono";
import { compress } from "hono/compress";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";

import routes from "./routes";

import "./queues/ai-indexer/worker";
import "./queues/keyword-indexer/worker";

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
