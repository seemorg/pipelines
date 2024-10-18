import { Queue } from "bullmq";

import { createRedis } from "./lib/redis";

export const BOOKS_QUEUE_NAME = "books_queue";
export const BOOKS_QUEUE_REDIS = createRedis();

export type BookQueueData =
  | {
      turathId: number;
    }
  | {
      arabicName: string;
      authorArabicName: string;
      slug: string;
    };

export const booksQueue = new Queue<BookQueueData>(BOOKS_QUEUE_NAME, {
  connection: BOOKS_QUEUE_REDIS,
});
