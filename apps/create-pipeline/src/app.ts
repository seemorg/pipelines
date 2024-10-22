import { Hono } from "hono";
import { compress } from "hono/compress";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";

import routes from "./routes";

import "./queues/book/book-worker";
import "./queues/author/author-worker";
import "./queues/book-cover/book-cover-worker";

const app = new Hono();

app.use(
  secureHeaders({
    // crossOriginOpenerPolicy: "same-origin",
    crossOriginResourcePolicy: "cross-origin",
  }),
);
app.use(compress());
app.use(cors());

app.route("/", routes);

export default app;
