import { generateBookCoverAndUploadToR2 } from "@/stages/book-covers/generate";
import { Worker } from "bullmq";

import { chunk } from "@usul/utils";

import type { RegenerationQueueData } from "./regeneration-queue";
import { db } from "../../lib/db";
import {
  languagesWithoutArabic,
  languagesWithoutEnglish,
} from "../../lib/languages";
import { translateBiography } from "../../stages/biography";
import { localizeName } from "../../stages/localization";
import {
  REGENERATION_QUEUE_NAME,
  REGENERATION_QUEUE_REDIS,
  regenerationQueue,
} from "./regeneration-queue";

export const worker = new Worker<RegenerationQueueData>(
  REGENERATION_QUEUE_NAME,
  async (job) => {
    const data = job.data;
    if (data.type === "book") {
      const book = await db.book.findFirst({
        where: { id: data.id },
        select: {
          id: true,
          slug: true,
          primaryNameTranslations: {
            where: {
              locale: "ar",
            },
          },
          author: {
            select: {
              primaryNameTranslations: {
                where: {
                  locale: "ar",
                },
              },
            },
          },
        },
      });

      if (!book) {
        throw new Error(`Book with id ${data.id} not found`);
      }

      const arabicName = book.primaryNameTranslations[0]?.text;
      const authorArabicName = book.author.primaryNameTranslations[0]?.text;

      if (!arabicName || !authorArabicName) {
        throw new Error("Book or author arabic name not found");
      }

      let localizedNames: { locale: string; text: string }[] | null = null;
      if (data.regenerateNames) {
        localizedNames = (
          await Promise.all(
            languagesWithoutArabic.map(async (language) => {
              return {
                locale: language.code,
                text: await localizeName(
                  {
                    primaryArabicName: arabicName,
                  },
                  "book",
                  language.code,
                ),
              };
            }),
          )
        ).filter(
          (name): name is { locale: string; text: string } =>
            name.text !== null,
        );
      }

      let bookCover: string | null = null;
      if (data.regenerateCover || data.regenerateNames) {
        // 6. generate book cover
        const bookCoverResponse = await generateBookCoverAndUploadToR2({
          name: arabicName,
          authorName: authorArabicName,
          slug: book.slug,
          override: true,
        });

        if (bookCoverResponse?.url) {
          bookCover = bookCoverResponse.url;
        }
      }

      if (bookCover || localizedNames) {
        await db.book.update({
          where: { id: book.id },
          data: {
            ...(bookCover && { coverImageUrl: bookCover }),
            ...(localizedNames && {
              primaryNameTranslations: {
                upsert: localizedNames.map((name) => ({
                  where: {
                    bookId_locale: { bookId: book.id, locale: name.locale },
                  },
                  update: { text: name.text },
                  create: { text: name.text, locale: name.locale },
                })),
              },
            }),
          },
        });
      }

      return {
        success: true,
      };
    }

    // means this is an author regeneration
    const author = await db.author.findFirst({
      where: { id: data.id },
      select: {
        id: true,
        slug: true,
        primaryNameTranslations: {
          where: {
            locale: {
              in: ["ar", "en"],
            },
          },
        },
      },
    });

    if (!author) {
      throw new Error(`Author with id ${data.id} not found`);
    }

    const authorArabicName = author.primaryNameTranslations.find(
      (name) => name.locale === "ar",
    )?.text;
    let authorEnglishName = author.primaryNameTranslations.find(
      (name) => name.locale === "en",
    )?.text;

    if (!authorArabicName || !authorEnglishName) {
      throw new Error("Author arabic or english name not found");
    }

    let localizedNames: { locale: string; text: string }[] | null = null;
    if (data.regenerateNames) {
      localizedNames = (
        await Promise.all(
          languagesWithoutArabic.map(async (language) => {
            return {
              locale: language.code,
              text: await localizeName(
                { primaryArabicName: authorArabicName },
                "author",
                language.code,
              ),
            };
          }),
        )
      ).filter(
        (name): name is { locale: string; text: string } => name.text !== null,
      );

      const newEnglishName = localizedNames.find(
        (name) => name.locale === "en",
      )?.text;
      if (newEnglishName) {
        authorEnglishName = newEnglishName;
      }
    }

    let bios: { locale: string; text: string }[] | null = null;
    if (data.bioAr || data.bioEn) {
      // 6. translate bios
      bios = (
        await Promise.all(
          (data.bioAr ? languagesWithoutArabic : languagesWithoutEnglish).map(
            async (language) => {
              const text = await translateBiography(
                {
                  text: (data.bioAr || data.bioEn)!,
                  locale: data.bioAr ? "ar" : "en",
                },
                language.code,
              );

              return {
                locale: language.code,
                text,
              };
            },
          ),
        )
      ).filter(
        (name): name is { locale: string; text: string } => name.text !== null,
      );
    }

    // update author
    if (bios || localizedNames) {
      await db.author.update({
        where: { id: author.id },
        data: {
          ...(localizedNames && {
            primaryNameTranslations: {
              upsert: localizedNames.map((name) => ({
                where: {
                  authorId_locale: { authorId: author.id, locale: name.locale },
                },
                update: { text: name.text },
                create: { text: name.text, locale: name.locale },
              })),
            },
          }),
          ...(bios && {
            bioTranslations: {
              upsert: bios.map((bio) => ({
                where: {
                  authorId_locale: { authorId: author.id, locale: bio.locale },
                },
                update: { text: bio.text },
                create: { text: bio.text, locale: bio.locale },
              })),
            },
          }),
        },
      });

      // if name is updated, regenerate all book covers for this author
      if (localizedNames) {
        const books = await db.book.findMany({
          where: {
            author: { id: author.id },
          },
        });
        const bookIdBatches = chunk(
          books.map((book) => book.id),
          10,
        );
        for (const bookIds of bookIdBatches) {
          await regenerationQueue.addBulk(
            bookIds.map((bookId) => ({
              name: `regenerate_book_${bookId}`,
              data: { type: "book", id: bookId, regenerateCover: true },
            })),
          );
        }
      }
    }

    return { success: true };
  },
  {
    connection: REGENERATION_QUEUE_REDIS,
    concurrency: 5,
  },
);
