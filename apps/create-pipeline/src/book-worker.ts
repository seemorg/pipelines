import type { TurathAllDataResponse } from "@usul/utils";
import { Worker } from "bullmq";
import slugify from "slugify";

import {
  getTurathAuthors,
  getTurathBooks,
  removeDiacritics,
} from "@usul/utils";

import type { BookQueueData } from "./book-queue";
import { BOOKS_QUEUE_NAME, BOOKS_QUEUE_REDIS } from "./book-queue";
import { db } from "./lib/db";
import { languagesWithoutEnglish } from "./lib/languages";
import { generateBookCoverAndUploadToR2 } from "./stages/book-covers/generate";
import { localizeName } from "./stages/localization";
import { transliterateName } from "./stages/transliteration";
import { generateVariations } from "./stages/variations";

const slugs = new Set<string>(
  (await db.book.findMany({ select: { slug: true } })).map((book) => book.slug),
);

const turathBooksById = (await getTurathBooks()).reduce(
  (acc, book) => {
    acc[book.id] = book;
    return acc;
  },
  {} as Record<number, TurathAllDataResponse["books"][number]>,
);

const turathAuthorsById = (await getTurathAuthors()).reduce(
  (acc, author) => {
    acc[author.id] = author;
    return acc;
  },
  {} as Record<number, TurathAllDataResponse["authors"][number]>,
);

export const worker = new Worker<BookQueueData>(
  BOOKS_QUEUE_NAME,
  async (job) => {
    const { turathId } = job.data;

    const turathBook = turathBooksById[turathId];
    if (!turathBook) {
      throw new Error(`Turath book with id ${turathId} not found`);
    }

    const turathAuthor = turathAuthorsById[turathBook.author_id];
    if (!turathAuthor) {
      throw new Error(
        `Turath author with id ${turathBook.author_id} not found`,
      );
    }

    const arabicName = turathBook.name;
    const authorArabicName = turathAuthor.name;

    // 1. localize name
    const englishName = await localizeName(
      {
        primaryArabicName: arabicName,
      },
      "book",
      "en",
    );

    if (!englishName) {
      throw new Error("Failed to localize name");
    }

    // 2. create slug
    const baseSlug = slugify(removeDiacritics(englishName), { lower: true });
    let slug = baseSlug;
    let i = 1;
    while (slugs.has(slug)) {
      slug = `${baseSlug}-${i}`;
      i++;
    }
    slugs.add(slug);

    // 3. localize name in other languages
    const localizedNames = (
      await Promise.all(
        languagesWithoutEnglish.map(async (language) => {
          return {
            locale: language.code,
            text: await localizeName(
              {
                primaryArabicName: arabicName,
                primaryLatinName: englishName,
              },
              "book",
              language.code,
            ),
          };
        }),
      )
    ).filter((name) => name.text !== null);

    // 4. transliterate name
    const transliteration = await transliterateName(arabicName, "book");

    // 5. create variations in each language
    const variations = await generateVariations(englishName, "book");

    // 6. generate book cover
    const bookCover = await generateBookCoverAndUploadToR2({
      name: arabicName,
      authorName: authorArabicName,
      slug,
    });

    return {
      slug,
      primaryNames: [{ locale: "en", text: englishName }, ...localizedNames],
      variations,
      transliteration,
      cover: bookCover?.url,
    };
  },
  {
    connection: BOOKS_QUEUE_REDIS,
  },
);
