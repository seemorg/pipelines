import { Queue } from "bullmq";

import { createRedis } from "../../lib/redis";

export const TYPESENSE_QUEUE_NAME = "typesense_queue";
export const TYPESENSE_QUEUE_REDIS = createRedis();

export interface TypesenseQueueData {
  requestedAt: number;
}

export const typesenseQueue = new Queue<TypesenseQueueData>(
  TYPESENSE_QUEUE_NAME,
  {
    connection: TYPESENSE_QUEUE_REDIS,
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: 10,
    },
  },
);
