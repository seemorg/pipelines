import { Worker } from "bullmq";
import slugify from "slugify";

import { removeDiacritics } from "@usul/utils";

import type { BookQueueData } from "./book-queue";
import { BOOKS_QUEUE_NAME, BOOKS_QUEUE_REDIS } from "./book-queue";
import {
  getBookSlugs,
  getTurathAuthorsById,
  getTurathBooksById,
} from "./lib/data";
import { languagesWithoutEnglish } from "./lib/languages";
import { generateBookCoverAndUploadToR2 } from "./stages/book-covers/generate";
import { localizeName } from "./stages/localization";
import { transliterateName } from "./stages/transliteration";
import { generateVariations } from "./stages/variations";

export const worker = new Worker<BookQueueData>(
  BOOKS_QUEUE_NAME,
  async (job) => {
    const { turathId } = job.data;

    const turathBooksById = await getTurathBooksById();
    const turathBook = turathBooksById[turathId];
    if (!turathBook) {
      throw new Error(`Turath book with id ${turathId} not found`);
    }

    const turathAuthorsById = await getTurathAuthorsById();

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
    const slugs = await getBookSlugs();
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
