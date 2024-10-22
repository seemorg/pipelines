import { Worker } from "bullmq";
import slugify from "slugify";

import { removeDiacritics } from "@usul/utils";

import type { BookQueueData } from "./book-queue";
import {
  getBookSlugs,
  getTurathAuthorsById,
  getTurathBooksById,
} from "../../lib/data";
import { db } from "../../lib/db";
import { languagesWithoutEnglish } from "../../lib/languages";
import { generateBookCoverAndUploadToR2 } from "../../stages/book-covers/generate";
import { localizeName } from "../../stages/localization";
import { transliterateName } from "../../stages/transliteration";
import { generateVariations } from "../../stages/variations";
import { BOOKS_QUEUE_NAME, BOOKS_QUEUE_REDIS } from "./book-queue";

export const worker = new Worker<BookQueueData>(
  BOOKS_QUEUE_NAME,
  async (job) => {
    const data = job.data;

    let arabicName: string;
    let authorArabicName: string;
    let slug: string;
    let transliteration: string | null = null;

    const isTurath = "turathId" in data;

    if (isTurath) {
      const { turathId } = data;

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

      arabicName = turathBook.name;
      authorArabicName = turathAuthor.name;
    } else {
      arabicName = data.arabicName;
      authorArabicName = data.authorArabicName;
    }

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

    // 2. create slug (if turath only)
    if (isTurath) {
      const slugs = await getBookSlugs();
      const baseSlug = slugify(removeDiacritics(englishName), {
        lower: true,
        trim: true,
        // remove special characters
        remove: /[*+~.()'"!:@]/g,
      });

      slug = baseSlug;
      let i = 1;
      while (slugs.has(slug)) {
        slug = `${baseSlug}-${i}`;
        i++;
      }
      slugs.add(slug);
    } else {
      slug = data.slug;
    }

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
    ).filter(
      (name): name is { locale: string; text: string } => name.text !== null,
    );

    if (isTurath) {
      // 4. transliterate name
      transliteration = await transliterateName(arabicName, "book");
    }

    // 5. create variations in each language
    const variations = await generateVariations(englishName, "book");

    // 6. generate book cover
    const bookCover = await generateBookCoverAndUploadToR2({
      name: arabicName,
      authorName: authorArabicName,
      slug,
    });

    const finalData = {
      slug,
      primaryNames: [{ locale: "en", text: englishName }, ...localizedNames],
      variations,
      transliteration,
      cover: bookCover?.url,
    };

    if (!isTurath) {
      // this means the request is coming from the usul admin panel
      // so we need to update the book data
      const book = await db.book.findFirst({ where: { slug } });
      if (!book) {
        throw new Error(`Book with slug ${slug} not found`);
      }

      await db.book.update({
        where: { id: book.id },
        data: {
          primaryNameTranslations: {
            upsert: finalData.primaryNames.map((name) => ({
              where: {
                bookId_locale: { bookId: book.id, locale: name.locale },
              },
              update: { text: name.text },
              create: { text: name.text, locale: name.locale },
            })),
          },
        },
      });
    }

    return finalData;
  },
  {
    connection: BOOKS_QUEUE_REDIS,
    concurrency: 5,
  },
);
