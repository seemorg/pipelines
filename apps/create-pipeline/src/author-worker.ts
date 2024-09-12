import type { TurathAllDataResponse } from "@usul/utils";
import { Worker } from "bullmq";
import slugify from "slugify";

import { getTurathAuthors, removeDiacritics } from "@usul/utils";

import type { AuthorQueueData } from "./author-queue";
import {
  AUTHORS_QUEUE_NAME,
  AUTHORS_QUEUE_REDIS,
  authorsQueue,
} from "./author-queue";
import { db } from "./lib/db";
import { languages, languagesWithoutEnglish } from "./lib/languages";
import { generateBiography } from "./stages/biography";
import { localizeName } from "./stages/localization";
import { transliterateName } from "./stages/transliteration";
import { generateVariations } from "./stages/variations";

// import { BookStatus } from "@usul-ocr/db";

const authors = await db.author.findMany({ select: { id: true, slug: true } });
const slugs = new Set<string>(authors.map((author) => author.slug));
const existingTurathAuthorIds = new Set<string>(
  (await authorsQueue.getCompleted())
    .map((job) => job.data.turathId.toString())
    .concat(
      authors
        .filter((a) => a.id.startsWith("turath:"))
        .map((author) => author.id.split(":")[1]!),
    ),
);

const turathAuthorsById = (await getTurathAuthors()).reduce(
  (acc, author) => {
    acc[author.id] = author;
    return acc;
  },
  {} as Record<number, TurathAllDataResponse["authors"][number]>,
);

export const worker = new Worker<AuthorQueueData>(
  AUTHORS_QUEUE_NAME,
  async (job) => {
    const { turathId } = job.data;

    const turathAuthor = turathAuthorsById[turathId];
    if (!turathAuthor) {
      throw new Error(`Turath author with id ${turathId} not found`);
    }

    if (existingTurathAuthorIds.has(turathId.toString())) {
      return { skipped: true };
    }

    const arabicName = turathAuthor.name;

    // 1. localize name
    const englishName = await localizeName(
      {
        primaryArabicName: arabicName,
      },
      "author",
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
              "author",
              language.code,
            ),
          };
        }),
      )
    ).filter((name) => name.text !== null);

    // 4. transliterate name
    const transliteration = await transliterateName(arabicName, "author");

    // 5. create variations in each language
    const variations = await generateVariations(englishName, "author");

    // 6. generate bios
    const bios = (
      await Promise.all(
        languages.map(async (language) => {
          return {
            locale: language.code,
            text: await generateBiography(
              {
                primaryArabicName: arabicName,
                primaryLatinName: englishName,
              },

              language.code,
            ),
          };
        }),
      )
    ).filter((name) => name.text !== null);

    existingTurathAuthorIds.add(turathId.toString());

    return {
      slug,
      primaryNames: [{ locale: "en", text: englishName }, ...localizedNames],
      variations,
      transliteration,
      bios,
    };
  },
  {
    connection: AUTHORS_QUEUE_REDIS,
  },
);
