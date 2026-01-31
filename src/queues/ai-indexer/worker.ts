import path from "path";
import { Worker } from "bullmq";

import type { AiIndexerQueueData } from "./queue";
import { AI_INDEXER_QUEUE_NAME, AI_INDEXER_QUEUE_REDIS } from "./queue";

export const worker = new Worker<AiIndexerQueueData>(
  AI_INDEXER_QUEUE_NAME,
  path.resolve("dist/workers/ai-indexer.worker.js"),
  {
    connection: AI_INDEXER_QUEUE_REDIS,
    concurrency: 20,
    lockDuration: 1000 * 60 * 40, // 40 minutes
    // stalledInterval: 1000 * 60 * 40, // 40 minutes
  },
);
