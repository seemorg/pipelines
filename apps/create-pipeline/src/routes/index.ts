import { Hono } from "hono";

import authorsRoutes from "./authors";
import bookCoversRoutes from "./book-covers";
import booksRoutes from "./books";
import uiRoutes from "./ui";
import uptimeRoutes from "./uptime";

const routes = new Hono();

routes.route("/", uptimeRoutes);
routes.route("/", uiRoutes);
routes.route("/", authorsRoutes);
routes.route("/", bookCoversRoutes);
routes.route("/", booksRoutes);

export default routes;
