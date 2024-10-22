import { db } from "@/lib/db";
import { generateBookCoverAndUploadToR2 } from "@/stages/book-covers/generate";
import { Worker } from "bullmq";

import {
  BOOK_COVERS_QUEUE_NAME,
  BOOK_COVERS_QUEUE_REDIS,
  BookCoverQueueData,
} from "./book-cover-queue";

export const worker = new Worker<BookCoverQueueData>(
  BOOK_COVERS_QUEUE_NAME,
  async (job) => {
    const data = job.data;

    const book = await db.book.findUnique({
      where: { id: data.bookId },
      select: {
        slug: true,
        primaryNameTranslations: {
          where: {
            locale: {
              in: ["ar", "en"],
            },
          },
        },
        author: {
          select: {
            primaryNameTranslations: {
              where: {
                locale: {
                  in: ["ar", "en"],
                },
              },
            },
          },
        },
      },
    });

    if (!book) {
      throw new Error("Book not found");
    }

    const bookLocales = book.primaryNameTranslations.reduce(
      (acc, translation) => {
        acc[translation.locale] = translation.text;
        return acc;
      },
      {} as Record<string, string>,
    );
    const authorLocales = book.author.primaryNameTranslations.reduce(
      (acc, translation) => {
        acc[translation.locale] = translation.text;
        return acc;
      },
      {} as Record<string, string>,
    );

    const bookName = bookLocales.ar ?? bookLocales.en;
    const authorName = authorLocales.ar ?? authorLocales.en;

    if (!bookName) {
      throw new Error("Book has no english or arabic name");
    }

    if (!authorName) {
      throw new Error("Author has no english or arabic name");
    }

    const bookCover = await generateBookCoverAndUploadToR2({
      name: bookName,
      authorName,
      slug: book.slug,
      override: true,
    });

    if (!bookCover?.success || !bookCover?.url) {
      throw new Error("Failed to generate book cover");
    }

    // update in the DB
    await db.book.update({
      where: { id: data.bookId },
      data: { coverImageUrl: bookCover.url },
    });

    return { url: bookCover.url };
  },
  {
    connection: BOOK_COVERS_QUEUE_REDIS,
    concurrency: 5,
    removeOnComplete: { count: 10 },
  },
);
