import path from "path";
import { Worker } from "bullmq";

import type { TypesenseQueueData } from "./typesense-queue";
import { TYPESENSE_QUEUE_NAME, TYPESENSE_QUEUE_REDIS } from "./typesense-queue";

export const worker = new Worker<TypesenseQueueData>(
  TYPESENSE_QUEUE_NAME,
  path.resolve("dist/typesense.worker.js"),
  {
    connection: TYPESENSE_QUEUE_REDIS,
    concurrency: 1,
  },
);
