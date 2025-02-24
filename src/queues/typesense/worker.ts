import path from "path";
import { Worker } from "bullmq";

import type { TypesenseQueueData } from "./queue";
import { TYPESENSE_QUEUE_NAME, TYPESENSE_QUEUE_REDIS } from "./queue";

export const worker = new Worker<TypesenseQueueData>(
  TYPESENSE_QUEUE_NAME,
  path.resolve("dist/workers/typesense.worker.js"),
  {
    connection: TYPESENSE_QUEUE_REDIS,
    concurrency: 1,
  },
);
