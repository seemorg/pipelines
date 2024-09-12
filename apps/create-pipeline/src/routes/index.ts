import { Hono } from "hono";

import uiRoutes from "./ui";
import uptimeRoutes from "./uptime";

const routes = new Hono();

routes.route("/", uptimeRoutes);
routes.route("/", uiRoutes);

export default routes;
