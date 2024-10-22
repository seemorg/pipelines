import { Queue } from "bullmq";

import { createRedis } from "../../lib/redis";

export const BOOK_COVERS_QUEUE_NAME = "book_covers_queue";
export const BOOK_COVERS_QUEUE_REDIS = createRedis();

export type BookCoverQueueData = {
  bookId: string;
};

export const bookCoversQueue = new Queue<BookCoverQueueData>(
  BOOK_COVERS_QUEUE_NAME,
  {
    connection: BOOK_COVERS_QUEUE_REDIS,
  },
);
