import { Worker } from "bullmq";

import type { BookQueueData } from "./book-queue";
import { BOOKS_QUEUE_NAME, BOOKS_QUEUE_REDIS } from "./book-queue";
import { indexOpenitiBook } from "./indexer/openiti";
import { indexTurathBook } from "./indexer/turath";
import { db } from "./lib/db";
import { getBooksData } from "./lib/services/books";

const booksData = await getBooksData();

const aiSupportedBooks = new Set(
  booksData.filter((b) => b.flags.aiSupported).map((b) => b.id),
);

const updateBookFlags = async (
  book: {
    id: string;
    flags: PrismaJson.BookFlags;
  },
  versionId: string,
) => {
  // update book flags
  await db.book.update({
    where: {
      id: book.id,
    },
    data: {
      flags: {
        ...book.flags,
        aiSupported: true,
        aiVersion: versionId,
      } as PrismaJson.BookFlags,
    },
  });
  aiSupportedBooks.add(book.id);
};

export const worker = new Worker<BookQueueData>(
  BOOKS_QUEUE_NAME,
  async (job) => {
    const { id } = job.data;
    const book = booksData.find((b) => b.id === id);

    if (!book) {
      throw new Error(`Book not found: ${id}`);
    }

    if (aiSupportedBooks.has(id)) {
      return { skipped: true };
    }

    const hasTurathBook = !!book.versions.find((v) => v.source === "turath");

    if (hasTurathBook) {
      const result = await indexTurathBook({ id });

      if (result.status === "success") {
        await updateBookFlags(book, String(result.versionId!));
      }

      return result;
    }

    // index openiti
    const result = await indexOpenitiBook({ id });
    if (result.status !== "success" && result.status !== "skipped") {
      throw new Error(JSON.stringify(result));
    }

    if (result.status === "success") {
      await updateBookFlags(book, result.versionId!);
    }

    return result;
  },
  {
    connection: BOOKS_QUEUE_REDIS,
    concurrency: 3,
  },
);
