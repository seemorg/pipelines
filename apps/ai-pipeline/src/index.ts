import { serve } from "@hono/node-server";
import { showRoutes } from "hono/dev";

import app from "./app";
import { setUptime } from "./lib/uptime";

showRoutes(app);

let port = 8080;
if (process.env.PORT) {
  const portInt = parseInt(process.env.PORT);
  if (portInt && !isNaN(portInt)) {
    port = portInt;
  }
}

serve({ fetch: app.fetch, port }, ({ address, port }) => {
  setUptime();
  console.log(`Server started on ${address}:${port}...`);
});
