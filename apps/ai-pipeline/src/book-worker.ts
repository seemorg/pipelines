import { Worker } from "bullmq";

import type { BookQueueData } from "./book-queue";
import { BOOKS_QUEUE_NAME, BOOKS_QUEUE_REDIS } from "./book-queue";
import { indexTurathBook } from "./indexer/turath";

export const worker = new Worker<BookQueueData>(
  BOOKS_QUEUE_NAME,
  async (job) => {
    const { id } = job.data;

    const result = await indexTurathBook({ id });

    return result;
  },
  {
    connection: BOOKS_QUEUE_REDIS,
    removeOnComplete: {
      age: 3600 * 24 * 7, // keep up to 24 hours
    },
  },
);
