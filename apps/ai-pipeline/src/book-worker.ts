import { Worker } from "bullmq";

import type { BookQueueData } from "./book-queue";
import { BOOKS_QUEUE_NAME, BOOKS_QUEUE_REDIS } from "./book-queue";
import { indexOpenitiBook } from "./indexer/openiti";
import { indexTurathBook } from "./indexer/turath";
import { getBooksData } from "./lib/services/books";

const booksData = await getBooksData();

export const worker = new Worker<BookQueueData>(
  BOOKS_QUEUE_NAME,
  async (job) => {
    const { id } = job.data;
    const book = booksData.find((b) => b.id === id);

    if (!book) {
      throw new Error(`Book not found: ${id}`);
    }

    if (book.flags.aiSupported) {
      return { skipped: true };
    }

    const hasTurathBook = !!book.versions.find((v) => v.source === "turath");

    if (hasTurathBook) {
      const result = await indexTurathBook({ id });
      return result;
    }

    // index openiti
    const result = await indexOpenitiBook({ id });
    if (result.status !== "success" && result.status !== "skipped") {
      throw new Error(JSON.stringify(result));
    }

    return result;
  },
  {
    connection: BOOKS_QUEUE_REDIS,
    concurrency: 3,
  },
);
