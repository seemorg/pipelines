import { listAllObjects } from "@/lib/r2";
import { getAuthorsData } from "@/lib/services/authors";
import { getBooksData } from "@/lib/services/books";

import { generateBookCoverAndUploadToR2 } from "./generate";

export const sanitizeAllCovers = async () => {
  const objects = (await listAllObjects("patterns/")).filter(
    (object) => object.Size === 842,
  );

  if (objects.length === 0) {
    console.log("No invalid patterns found");
    process.exit(0);
  }

  console.log(`Found ${objects.length} invalid patterns`);

  const authors = await getAuthorsData();
  const authorIdToAuthor = authors.reduce(
    (acc, author) => {
      acc[author.id] = author;
      return acc;
    },
    {} as Record<string, Omit<(typeof authors)[number], "books">>,
  );

  const allBooks = await getBooksData();

  const slugToBook = allBooks.reduce(
    (acc, book) => {
      acc[book.slug] = book;
      return acc;
    },
    {} as Record<string, (typeof allBooks)[number]>,
  );

  let i = 1;
  for (const object of objects) {
    console.log(`Processing pattern ${i} / ${objects.length}`);
    i++;

    // regenerate pattern and cover
    const slug = object.Key?.replace("patterns/", "")?.replace(".png", "");

    if (!slug) {
      console.log("Invalid slug");
      continue;
    }

    const book = slugToBook[slug];
    if (!book) {
      console.log("Book not found");
      continue;
    }

    const author = authorIdToAuthor[book.authorId];
    if (!author) {
      console.log("Author not found");
      continue;
    }

    const bookName = book.primaryNames.find(
      (name) => name.locale === "ar",
    )?.text;
    const authorName = author.primaryNames.find(
      (name) => name.locale === "ar",
    )?.text;

    if (!bookName || !authorName) {
      console.log("Book or author name not found");
      continue;
    }

    await generateBookCoverAndUploadToR2({
      slug,
      name: bookName,
      authorName: authorName,
      override: true,
    });
  }
};
