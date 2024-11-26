import { typesenseQueue } from "@/queues/typesense/typesense-queue";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";

import { env } from "../env";

const basePath = "/typesense";
const typesenseRoutes = new Hono().basePath(basePath);

typesenseRoutes.use(
  bearerAuth({
    token: env.USUL_PIPELINE_API_KEY,
  }),
);

typesenseRoutes.post("/index", async (c) => {
  // Check if there's already an active job
  const activeJobs = await typesenseQueue.getActive();
  const waitingJobs = await typesenseQueue.getWaiting();

  if (activeJobs.length > 0 || waitingJobs.length > 0) {
    return c.json(
      {
        status: "IN_PROGRESS",
        error: "A re-index operation is already in progress",
      },
      409,
    );
  }

  const requestedAt = Date.now();
  await typesenseQueue.add("re-index", {
    requestedAt,
  });

  return c.json({
    status: "STARTED",
    requestedAt,
  });
});

typesenseRoutes.get("/status", async (c) => {
  const activeJobs = await typesenseQueue.getActive();
  const waitingJobs = await typesenseQueue.getWaiting();

  if (activeJobs.length > 0 || waitingJobs.length > 0) {
    const lastJob = activeJobs.length > 0 ? activeJobs[0] : waitingJobs[0];
    const requestedAt = lastJob!.data.requestedAt;

    return c.json({
      status: "BUSY",
      requestedAt,
    });
  }

  return c.json({
    status: "IDLE",
  });
});

export default typesenseRoutes;
