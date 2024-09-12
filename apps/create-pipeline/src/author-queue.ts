import { Queue } from "bullmq";

import { createRedis } from "./lib/redis";

export const AUTHORS_QUEUE_NAME = "create_pipeline_authors_queue";
export const AUTHORS_QUEUE_REDIS = createRedis();

export type AuthorQueueData = {
  turathId: number;
};

export const authorsQueue = new Queue<AuthorQueueData>(AUTHORS_QUEUE_NAME, {
  connection: AUTHORS_QUEUE_REDIS,
});
