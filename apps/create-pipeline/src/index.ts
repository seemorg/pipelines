import { serve } from "@hono/node-server";
import { showRoutes } from "hono/dev";

console.log("Starting app and loading necessary data...");

import app from "./app";
import { setUptime } from "./lib/uptime";

showRoutes(app);

let port = 3000;
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
