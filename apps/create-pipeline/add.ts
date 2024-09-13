import { authorsQueue } from "@/author-queue";
import { booksQueue } from "@/book-queue";
import { db } from "@/lib/db";

import { chunk } from "@usul/utils";

import newTexts from "./new-turath-books.json";
import { getTurathAuthorsById } from "./src/lib/data";

const batches = chunk(newTexts, 10);

// turath books on usul
const turathBookOnUsul = new Set<string>(
  (
    await db.book.findMany({
      select: {
        versions: true,
      },
    })
  ).flatMap((book) =>
    book.versions.filter((v) => v.source === "turath").map((v) => v.value),
  ),
);

let i = 0;
for (const batch of batches) {
  console.log(`Processing batch ${++i} / ${batches.length}`);

  await booksQueue.addBulk(
    batch.map((book) => ({
      name: `book_${book.id}`,
      data: {
        turathId: book.id,
      },
    })),
  );
}

const turathAuthorsById = await getTurathAuthorsById();
const uniqueAuthorIds = new Set<number>(
  // filter out authors that have at least one book on usul
  newTexts
    .map((book) => book.author_id)
    .filter((authorId) => {
      const author = turathAuthorsById[authorId];
      return !author?.books.some((book) =>
        turathBookOnUsul.has(book.toString()),
      );
    }),
);

const authorBatches = chunk(Array.from(uniqueAuthorIds), 10);
let j = 0;
for (const authorBatch of authorBatches) {
  console.log(`Processing author batch ${++j} / ${authorBatches.length}`);

  await authorsQueue.addBulk(
    authorBatch.map((authorId) => ({
      name: `author_${authorId}`,
      data: {
        turathId: authorId,
      },
    })),
  );
}

console.log("done");
