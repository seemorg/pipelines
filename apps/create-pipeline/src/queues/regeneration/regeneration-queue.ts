import { Queue } from "bullmq";

import { createRedis } from "../../lib/redis";

export const REGENERATION_QUEUE_NAME = "regeneration_queue";
export const REGENERATION_QUEUE_REDIS = createRedis();

export type RegenerationQueueData =
  | {
      type: "book";
      id: string;
      regenerateNames?: boolean;
      regenerateCover?: boolean;
    }
  | {
      type: "author";
      id: string;
      regenerateNames?: boolean;
      regenerateBio?: boolean;
    };

export const regenerationQueue = new Queue<RegenerationQueueData>(
  REGENERATION_QUEUE_NAME,
  {
    connection: REGENERATION_QUEUE_REDIS,
  },
);
