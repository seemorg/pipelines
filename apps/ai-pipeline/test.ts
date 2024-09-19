import { booksQueue } from "@/book-queue";
import { getBooksData } from "@/lib/services/books";

import { chunk } from "@usul/utils";

const books = (await getBooksData()).filter(
  (book) => book.flags.aiSupported !== true,
);

console.log(`Found ${books.length} books to index`);

const batches = chunk(books, 10);

let i = 0;
for (const books of batches) {
  console.log(`Processing batch ${++i} of ${batches.length}`);

  await booksQueue.addBulk(
    books.map((book) => ({
      name: `book-${book.id}`,
      data: {
        id: book.id,
      },
    })),
  );
}

console.log("Done");
