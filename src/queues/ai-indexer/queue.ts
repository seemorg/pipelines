import { createRedis } from "@/lib/redis";
import { Queue } from "bullmq";

export const AI_INDEXER_QUEUE_NAME = "ai_indexer_queue";
export const AI_INDEXER_QUEUE_REDIS = createRedis();

export type AiIndexerQueueData = {
  id: string;
  versionId: string;
};

export const aiIndexerQueue = new Queue<AiIndexerQueueData>(
  AI_INDEXER_QUEUE_NAME,
  {
    connection: AI_INDEXER_QUEUE_REDIS,
  },
);
